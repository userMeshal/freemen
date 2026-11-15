"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { admins } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { edfapayConfigured, moyasarKeysPresent, saveSettings, siteUrl } from "@/lib/settings";
import { createWebhook, listWebhooks, resendWebhookVerification } from "@/lib/moyasar";
import { toLatinDigits } from "@/lib/normalize";
import {
  disconnectTelegram,
  linkPendingChats,
  removeTelegramChat,
  saveBotToken,
  sendTelegramTest,
  TelegramError,
} from "@/lib/telegram";
import { bool, fail, firstError, ok, sarToHalalas, str, type ActionState } from "@/lib/admin-utils";

function refresh() {
  revalidateTag("settings");
  revalidatePath("/admin/settings");
}

const urlOrEmpty = (label: string) =>
  z
    .string()
    .max(300, `${label}: الرابط طويل جدًا`)
    .refine((v) => !v || /^https:\/\/[^\s]+$/i.test(v), `${label}: اكتب رابطًا كاملًا يبدأ بـ https://`);

const storeSchema = z.object({
  storeName: z.string().min(1, "اسم المتجر مطلوب").max(80, "اسم المتجر طويل جدًا"),
  tagline: z.string().max(160, "الوصف المختصر طويل جدًا"),
  email: z.string().max(200).refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "البريد الإلكتروني غير صحيح"),
  phone: z.string().max(30).refine((v) => !v || /^\+?[\d\s-]{6,20}$/.test(v), "رقم الهاتف غير صحيح"),
  whatsapp: z.string().max(30).refine((v) => !v || /^\+?\d{8,15}$/.test(v), "رقم واتساب: أرقام فقط مع مفتاح الدولة، مثل 9665XXXXXXXX"),
  instagram: urlOrEmpty("إنستغرام"),
  tiktok: urlOrEmpty("تيك توك"),
  snapchat: urlOrEmpty("سناب شات"),
  x: urlOrEmpty("X"),
  crNumber: z.string().max(40, "السجل التجاري طويل جدًا"),
  vatNumber: z.string().max(40, "الرقم الضريبي طويل جدًا"),
  vatRate: z.coerce.number({ message: "نسبة الضريبة يجب أن تكون رقمًا" }).min(0, "نسبة الضريبة لا تقل عن 0").max(100, "نسبة الضريبة لا تزيد عن 100"),
});

export async function saveStoreInfoAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = storeSchema.safeParse({
    storeName: str(fd, "storeName"),
    tagline: str(fd, "tagline"),
    email: str(fd, "email"),
    phone: toLatinDigits(str(fd, "phone")),
    whatsapp: toLatinDigits(str(fd, "whatsapp")).replace(/[\s-]/g, ""),
    instagram: str(fd, "instagram"),
    tiktok: str(fd, "tiktok"),
    snapchat: str(fd, "snapchat"),
    x: str(fd, "x"),
    crNumber: toLatinDigits(str(fd, "crNumber")),
    vatNumber: toLatinDigits(str(fd, "vatNumber")),
    vatRate: toLatinDigits(str(fd, "vatRate")) || "0",
  });
  if (!parsed.success) return fail(firstError(parsed.error));
  await saveSettings(parsed.data);
  refresh();
  return ok("تم حفظ بيانات المتجر");
}

const marketingSchema = z.object({
  announcement: z.string().max(200, "نص الشريط الإعلاني طويل جدًا (200 حرف كحد أقصى)"),
  metaPixelId: z.string().regex(/^\d{0,20}$/, "معرّف Meta Pixel يتكون من أرقام فقط"),
  tiktokPixelId: z.string().regex(/^[A-Za-z0-9]{0,40}$/, "معرّف TikTok Pixel يتكون من أحرف إنجليزية وأرقام فقط"),
});

export async function saveMarketingAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = marketingSchema.safeParse({
    announcement: str(fd, "announcement"),
    metaPixelId: toLatinDigits(str(fd, "metaPixelId")),
    tiktokPixelId: str(fd, "tiktokPixelId").toUpperCase(),
  });
  if (!parsed.success) return fail(firstError(parsed.error));
  await saveSettings(parsed.data);
  refresh();
  revalidatePath("/", "layout");
  return ok("تم حفظ إعدادات الإعلان والتتبع");
}

export async function savePaymentAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const codFee = sarToHalalas(str(fd, "codFee")) ?? 0;
  if (Number.isNaN(codFee) || codFee > 100_000) return fail("رسوم الدفع عند الاستلام غير صالحة");
  const edfapayEnabled = bool(fd, "edfapayEnabled");
  const moyasarEnabled = bool(fd, "moyasarEnabled");
  const codEnabled = bool(fd, "codEnabled");
  const applePayDomainFile = String(fd.get("applePayDomainFile") ?? "").trim();
  if (applePayDomainFile.length > 20_000) return fail("ملف التحقق من Apple Pay أكبر من المتوقع");
  await saveSettings({
    edfapayEnabled,
    moyasarEnabled,
    moyasarApplePay: bool(fd, "moyasarApplePay"),
    moyasarStcPay: bool(fd, "moyasarStcPay"),
    applePayDomainFile,
    codEnabled,
    codFee,
  });
  refresh();
  const online = (moyasarEnabled && moyasarKeysPresent()) || (edfapayEnabled && edfapayConfigured());
  if (!codEnabled && !online) {
    return ok("تم الحفظ — تنبيه: لا توجد وسيلة دفع متاحة للعملاء الآن (فعّل الدفع عند الاستلام أو أضف مفاتيح بوابة الدفع).");
  }
  return ok("تم حفظ إعدادات الدفع");
}

/** يسجّل رابط الإشعارات (Webhook) في حساب ميسر تلقائيًا؛ رمز التفعيل يُرسَل للرابط نفسه ويُؤكَّد آليًا */
export async function connectMoyasarWebhookAction(_prev: ActionState, _fd: FormData): Promise<ActionState> {
  await requireAdmin();
  if (!moyasarKeysPresent()) return fail("أضف مفاتيح ميسر في متغيرات البيئة أولًا ثم أعد النشر");
  const url = `${siteUrl()}/api/webhooks/moyasar`;
  // ميسر يشترط https؛ نستثني localhost للاختبار المحلي فقط
  if (!url.startsWith("https://") && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(url)) {
    return fail("رابط الموقع يجب أن يبدأ بـ https حتى يقبله ميسر");
  }
  try {
    const existing = (await listWebhooks()).find((w) => w.url === url);
    if (existing?.verified) {
      refresh();
      return ok("الإشعارات مربوطة ومفعّلة مسبقًا");
    }
    if (existing) {
      await resendWebhookVerification(existing.id);
      refresh();
      return ok("أُعيد إرسال رمز التفعيل — حدّث الصفحة بعد لحظات للتأكد");
    }
    const created = await createWebhook(url);
    refresh();
    return ok(created.verified ? "تم ربط إشعارات ميسر وتفعيلها" : "تم تسجيل الإشعارات — يجري تفعيلها تلقائيًا، حدّث الصفحة بعد لحظات");
  } catch (e) {
    console.error("[moyasar] connect webhook failed", e);
    return fail("تعذّر ربط الإشعارات مع ميسر. تأكد من صحة المفتاح السري ثم أعد المحاولة.");
  }
}

/* ───────── إشعارات الطلبات على تيليجرام ───────── */

const telegramFail = (e: unknown, fallback: string) => {
  if (e instanceof TelegramError) return fail(e.message);
  console.error("[telegram]", e);
  return fail(fallback);
};

export async function saveTelegramTokenAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  try {
    const config = await saveBotToken(str(fd, "botToken"));
    revalidatePath("/admin/settings");
    return ok(`تم حفظ البوت @${config.botUsername} — افتحه الآن واضغط Start ثم اضغط «أكملت — اربط جوالي»`);
  } catch (e) {
    return telegramFail(e, "تعذّر حفظ رمز البوت");
  }
}

export async function linkTelegramAction(_prev: ActionState, _fd: FormData): Promise<ActionState> {
  await requireAdmin();
  try {
    const added = await linkPendingChats();
    revalidatePath("/admin/settings");
    if (!added.length) return fail("لم نجد رسالتك بعد. افتح رابط البوت من الزر أعلاه، اضغط Start داخل تيليجرام، ثم أعد المحاولة.");
    return ok(`تم ربط: ${added.join("، ")} — وصلتك رسالة تأكيد على تيليجرام`);
  } catch (e) {
    return telegramFail(e, "تعذّر إكمال الربط");
  }
}

export async function testTelegramAction(_prev: ActionState, _fd: FormData): Promise<ActionState> {
  await requireAdmin();
  try {
    const delivered = await sendTelegramTest();
    return delivered ? ok("أُرسل الإشعار التجريبي — تفقّد تيليجرام") : fail("لم تصل الرسالة. إن كنت حظرت البوت أو حذفت المحادثة فأعد الربط.");
  } catch (e) {
    return telegramFail(e, "تعذّر إرسال الإشعار التجريبي");
  }
}

export async function removeTelegramChatAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = Number(str(fd, "chatId"));
  if (!Number.isSafeInteger(id)) return fail("طلب غير صحيح");
  await removeTelegramChat(id);
  revalidatePath("/admin/settings");
  return ok("أُزيل الجوال من الإشعارات");
}

export async function disconnectTelegramAction(_prev: ActionState, _fd: FormData): Promise<ActionState> {
  await requireAdmin();
  await disconnectTelegram();
  revalidatePath("/admin/settings");
  return ok("تم فصل تيليجرام وحذف رمز البوت من المتجر");
}

const passwordRule = z.string().min(10, "كلمة المرور يجب ألا تقل عن 10 أحرف").max(200, "كلمة المرور طويلة جدًا");

export async function changePasswordAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const current = String(fd.get("current") ?? "");
  const next = String(fd.get("next") ?? "");
  const confirm = String(fd.get("confirm") ?? "");
  const parsed = passwordRule.safeParse(next);
  if (!parsed.success) return fail(firstError(parsed.error));
  if (next !== confirm) return fail("تأكيد كلمة المرور غير مطابق");
  if (!(await verifyPassword(current, admin.passwordHash))) return fail("كلمة المرور الحالية غير صحيحة");
  if (next === current) return fail("كلمة المرور الجديدة مطابقة للحالية");
  await db
    .update(admins)
    .set({ passwordHash: await hashPassword(next) })
    .where(eq(admins.id, admin.id));
  return ok("تم تغيير كلمة المرور");
}

const adminSchema = z.object({
  email: z.string().trim().toLowerCase().email("البريد الإلكتروني غير صحيح").max(200),
  name: z.string().min(2, "اسم المدير مطلوب").max(80, "الاسم طويل جدًا"),
  password: passwordRule,
});

export async function addAdminAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = adminSchema.safeParse({
    email: str(fd, "email"),
    name: str(fd, "name"),
    password: String(fd.get("password") ?? ""),
  });
  if (!parsed.success) return fail(firstError(parsed.error));
  const exists = await db.select({ id: admins.id }).from(admins).where(eq(admins.email, parsed.data.email)).limit(1);
  if (exists.length) return fail("يوجد مدير بهذا البريد مسبقًا");
  await db.insert(admins).values({
    email: parsed.data.email,
    name: parsed.data.name,
    passwordHash: await hashPassword(parsed.data.password),
  });
  revalidatePath("/admin/settings");
  return ok(`تمت إضافة المدير ${parsed.data.email}`);
}

export async function removeAdminAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = z.coerce.number().int().positive().safeParse(fd.get("id"));
  if (!parsed.success) return fail("مدير غير صالح");
  if (parsed.data === admin.id) return fail("لا يمكنك حذف حسابك الحالي");
  await db.delete(admins).where(eq(admins.id, parsed.data));
  revalidatePath("/admin/settings");
  return ok("تم حذف المدير");
}
