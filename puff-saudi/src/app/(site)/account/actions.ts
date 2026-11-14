"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { clientIp, endSession, getCustomer, startCustomerSession } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { rateLimit } from "@/lib/rate-limit";
import { normalizeSaudiPhone } from "@/lib/normalize";

export type AuthState = { error?: string; ok?: string; fields?: Record<string, string> };

const emailSchema = z.string().trim().toLowerCase().max(120).pipe(z.email());

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const ip = await clientIp();
  const email = emailSchema.safeParse(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  if (!email.success || !password) return { error: "أدخل البريد الإلكتروني وكلمة المرور." };
  if (!(await rateLimit(`login:${ip}`, 80, 900)) || !(await rateLimit(`login:${email.data}`, 8, 900)))
    return { error: "محاولات كثيرة. انتظر 15 دقيقة ثم أعد المحاولة." };

  const rows = await db.select().from(customers).where(eq(customers.email, email.data)).limit(1);
  const customer = rows[0];
  // نتحقق دائمًا من كلمة مرور (حتى لو لم يوجد الحساب) لتفادي كشف وجود البريد عبر التوقيت
  const valid = await verifyPassword(password, customer?.passwordHash ?? "scrypt$00$00");
  if (!customer || !valid) return { error: "البريد الإلكتروني أو كلمة المرور غير صحيحة." };

  await startCustomerSession(customer.id, customer.name);
  redirect("/account");
}

const registerSchema = z.object({
  name: z.string().trim().min(3).max(80).transform((v) => v.replace(/[<>]/g, "")),
  email: emailSchema,
  password: z.string().min(8).max(200),
});

export async function registerAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const ip = await clientIp();
  if (!(await rateLimit(`register:${ip}`, 40, 3600))) return { error: "محاولات كثيرة. حاول لاحقًا." };

  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const phone = normalizeSaudiPhone(String(formData.get("phone") ?? ""));
  const fields: Record<string, string> = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0]);
      fields[k] = k === "name" ? "اكتب الاسم الكامل" : k === "email" ? "بريد إلكتروني غير صحيح" : "كلمة المرور 8 أحرف على الأقل";
    }
  }
  if (!phone) fields.phone = "رقم جوال سعودي غير صحيح";
  if (!parsed.success || !phone) return { error: "راجع البيانات ثم أعد المحاولة.", fields };

  const { name, email, password } = parsed.data;
  const byEmail = await db.select({ id: customers.id }).from(customers).where(eq(customers.email, email)).limit(1);
  if (byEmail.length) return { error: "يوجد حساب بهذا البريد. سجّل الدخول بدلًا من ذلك.", fields: { email: "البريد مستخدم" } };

  const passwordHash = await hashPassword(password);
  const byPhone = await db.select().from(customers).where(eq(customers.phone, phone)).limit(1);
  let id: number;
  if (byPhone[0]) {
    if (byPhone[0].passwordHash) return { error: "يوجد حساب بهذا الرقم. سجّل الدخول بدلًا من ذلك.", fields: { phone: "الرقم مستخدم" } };
    // سجل ضيف سابق بنفس الرقم: نحوّله لحساب. طلباته السابقة لا تظهر في الحساب (لم يثبت ملكية الرقم).
    await db
      .update(customers)
      .set({ name, email, passwordHash, registeredAt: new Date(), address: null })
      .where(eq(customers.id, byPhone[0].id));
    id = byPhone[0].id;
  } else {
    const created = await db
      .insert(customers)
      .values({ name, email, phone, passwordHash, registeredAt: new Date() })
      .returning({ id: customers.id });
    id = created[0].id;
  }
  await startCustomerSession(id, name);
  redirect("/account");
}

export async function logoutAction() {
  await endSession("customer");
  redirect("/");
}

export async function updateProfileAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const customer = await getCustomer();
  if (!customer) redirect("/account/login");
  const name = z.string().trim().min(3).max(80).safeParse(formData.get("name"));
  if (!name.success) return { error: "اكتب الاسم الكامل." };
  const newPassword = String(formData.get("newPassword") ?? "");
  const patch: Partial<typeof customers.$inferInsert> = { name: name.data.replace(/[<>]/g, "") };
  if (newPassword) {
    if (newPassword.length < 8) return { error: "كلمة المرور الجديدة 8 أحرف على الأقل." };
    if (!(await verifyPassword(String(formData.get("currentPassword") ?? ""), customer.passwordHash)))
      return { error: "كلمة المرور الحالية غير صحيحة." };
    patch.passwordHash = await hashPassword(newPassword);
  }
  await db.update(customers).set(patch).where(eq(customers.id, customer.id));
  return { ok: "تم حفظ التغييرات." };
}
