"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { merchants, stores, type Store } from "@/db/schema";
import type { ActionState } from "@/components/dash/client";
import { merchantStore } from "@/lib/auth";
import { latinDigits, normalizePhone } from "@/lib/money";
import { hashPassword, verifyPassword } from "@/lib/password";
import { rateLimit } from "@/lib/rate-limit";
import { DEFAULT_SETTINGS } from "@/lib/stores";
import type { StoreContent, StoreSettings } from "@/lib/types";
import { NO_SESSION, done, fail, text, zSar, zodFail } from "../_lib/form";

function refresh(store: Store) {
  revalidatePath("/dashboard", "layout");
  revalidatePath(`/s/${store.slug}`, "layout");
}

/** يدمج التعديل في إعدادات المتجر الحالية دون المساس بباقي الحقول */
async function patchSettings(store: Store, patch: Partial<StoreSettings>) {
  await db
    .update(stores)
    .set({ settings: { ...DEFAULT_SETTINGS, ...store.settings, ...patch }, updatedAt: new Date() })
    .where(eq(stores.id, store.id));
  refresh(store);
}

// ───────────────────────── هوية المتجر ─────────────────────────

export async function saveIdentity(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await merchantStore();
  if (!ctx) return NO_SESSION;
  const name = text(form, "name", 60);
  if (name.length < 2) return fail("اكتب اسم المتجر (حرفين على الأقل)");
  await db
    .update(stores)
    .set({ name, tagline: text(form, "tagline", 90), description: text(form, "description", 300), updatedAt: new Date() })
    .where(eq(stores.id, ctx.store.id));
  refresh(ctx.store);
  return done("تم حفظ هوية المتجر");
}

// ───────────────────────── التواصل والسوشال ─────────────────────────

/** الجوال السعودي يُوحَّد إلى 05XXXXXXXX؛ غيره يُحفظ كما كُتب إن كان رقمًا دوليًا معقولًا */
function phone(raw: string): string | null {
  if (!raw) return "";
  const saudi = normalizePhone(raw);
  if (saudi) return saudi;
  const v = latinDigits(raw).replace(/[\s\-()]/g, "");
  return /^\+?\d{7,15}$/.test(v) ? v : null;
}

/** يقبل اسم الحساب أو رابطه ويحفظ اسم الحساب فقط بدون @ */
function handle(raw: string): string | null {
  if (!raw) return "";
  const last = raw.split(/[?#]/)[0].split("/").filter(Boolean).pop() ?? "";
  const v = last.replace(/^@/, "");
  return /^[A-Za-z0-9._-]{1,40}$/.test(v) ? v : null;
}

export async function saveContact(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await merchantStore();
  if (!ctx) return NO_SESSION;

  const email = text(form, "email", 120).toLowerCase();
  if (email && !z.email().safeParse(email).success) return fail("البريد الإلكتروني غير صحيح");
  const storePhone = phone(text(form, "phone", 25));
  if (storePhone === null) return fail("رقم الجوال غير صحيح — مثال: 0512345678");
  const whatsapp = phone(text(form, "whatsapp", 25));
  if (whatsapp === null) return fail("رقم الواتساب غير صحيح — مثال: 0512345678");

  const socials = { instagram: "انستقرام", tiktok: "تيك توك", snapchat: "سناب شات", x: "إكس" } as const;
  const patch: Partial<StoreSettings> = { email, phone: storePhone, whatsapp };
  for (const key of Object.keys(socials) as (keyof typeof socials)[]) {
    const v = handle(text(form, key, 120));
    if (v === null) return fail(`حساب ${socials[key]}: اكتب اسم الحساب بالإنجليزي (بدون مسافات) أو الصق رابطه`);
    patch[key] = v;
  }
  await patchSettings(ctx.store, patch);
  return done("تم حفظ بيانات التواصل");
}

// ───────────────────────── البيانات النظامية ─────────────────────────

export async function saveLegal(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await merchantStore();
  if (!ctx) return NO_SESSION;
  const crNumber = latinDigits(text(form, "crNumber", 20)).replace(/\s/g, "");
  const vatNumber = latinDigits(text(form, "vatNumber", 20)).replace(/\s/g, "");
  if (crNumber && !/^\d{10}$/.test(crNumber)) return fail("رقم السجل التجاري يتكوّن من 10 أرقام");
  if (vatNumber && !/^3\d{14}$/.test(vatNumber)) return fail("الرقم الضريبي يتكوّن من 15 رقمًا ويبدأ بـ 3");
  await patchSettings(ctx.store, { crNumber, vatNumber });
  return done("تم حفظ البيانات النظامية");
}

// ───────────────────────── الشحن ─────────────────────────

const ShippingInput = z.object({
  shippingFee: zSar("رسوم الشحن"),
  freeShippingOver: zSar("حد الشحن المجاني"),
  shippingDays: z.string().regex(/^\d{1,2}(-\d{1,2})?$/, "مدة التوصيل: اكتبها بالأيام مثل 3 أو 2-5"),
});

export async function saveShipping(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await merchantStore();
  if (!ctx) return NO_SESSION;
  const parsed = ShippingInput.safeParse({
    shippingFee: text(form, "shippingFee", 12) || "0",
    freeShippingOver: text(form, "freeShippingOver", 12) || "0",
    shippingDays: latinDigits(text(form, "shippingDays", 12)).replace(/\s/g, "").replace(/[–—]/g, "-"),
  });
  if (!parsed.success) return zodFail(parsed.error);
  if (parsed.data.shippingFee > 50000) return fail("رسوم الشحن: الحد الأقصى 500 ريال");
  await patchSettings(ctx.store, parsed.data);
  return done("تم حفظ إعدادات الشحن");
}

// ───────────────────────── بكسلات التتبع ─────────────────────────

export async function savePixels(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await merchantStore();
  if (!ctx) return NO_SESSION;
  // نفس الصيغ التي يقبلها مكوّن Pixels في المتجر — غيرها لا يُحقن أصلًا
  const metaPixelId = latinDigits(text(form, "metaPixelId", 40));
  const tiktokPixelId = text(form, "tiktokPixelId", 40);
  const snapPixelId = text(form, "snapPixelId", 40);
  if (metaPixelId && !/^\d{5,20}$/.test(metaPixelId)) return fail("معرّف بكسل ميتا أرقام فقط (من 5 إلى 20 رقمًا)");
  if (tiktokPixelId && !/^[A-Za-z0-9]{5,40}$/.test(tiktokPixelId)) return fail("معرّف بكسل تيك توك حروف إنجليزية وأرقام فقط");
  if (snapPixelId && !/^[A-Za-z0-9-]{5,40}$/.test(snapPixelId)) return fail("معرّف بكسل سناب حروف إنجليزية وأرقام وشرطات فقط");
  await patchSettings(ctx.store, { metaPixelId, tiktokPixelId, snapPixelId });
  return done("تم حفظ بكسلات التتبع");
}

// ───────────────────────── السياسات ─────────────────────────

export async function savePolicies(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await merchantStore();
  if (!ctx) return NO_SESSION;
  const content: StoreContent = {
    ...ctx.store.content,
    shippingPolicy: text(form, "shippingPolicy", 3000),
    returnsPolicy: text(form, "returnsPolicy", 3000),
  };
  await db.update(stores).set({ content, updatedAt: new Date() }).where(eq(stores.id, ctx.store.id));
  refresh(ctx.store);
  return done("تم حفظ السياسات");
}

// ───────────────────────── الحساب ─────────────────────────

export async function changePassword(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await merchantStore();
  if (!ctx) return NO_SESSION;
  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  if (next.length < 8) return fail("كلمة المرور الجديدة 8 أحرف على الأقل");
  if (next.length > 200) return fail("كلمة المرور طويلة جدًا");
  if (next === current) return fail("كلمة المرور الجديدة نفس الحالية");
  if (!(await rateLimit(`pw-change:${ctx.merchant.id}`, 8, 900))) return fail("محاولات كثيرة — جرّب بعد ربع ساعة");
  if (!(await verifyPassword(current, ctx.merchant.passwordHash))) return fail("كلمة المرور الحالية غير صحيحة");
  await db
    .update(merchants)
    .set({ passwordHash: await hashPassword(next) })
    .where(eq(merchants.id, ctx.merchant.id));
  return done("تم تغيير كلمة المرور");
}
