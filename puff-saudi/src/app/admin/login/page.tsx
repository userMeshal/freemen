import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/auth";
import { ActionForm, SubmitButton } from "@/components/admin/client";
import { Field, Input } from "@/components/admin/ui";
import { loginAction } from "./actions";

export const metadata: Metadata = { title: "دخول لوحة التحكم — PUFF SAUDI", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  if (await getAdmin()) redirect("/admin");
  return (
    <main className="grid min-h-screen place-items-center bg-ink px-4 py-10 font-body">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="font-display text-5xl font-black tracking-tight text-lime" dir="ltr">
            PUFF
          </div>
          <p className="mt-2 text-sm text-paper/60">لوحة تحكم المتجر</p>
        </div>
        <div className="rounded-3xl bg-paper p-6 shadow-2xl">
          <h1 className="mb-5 text-lg font-bold text-ink">تسجيل الدخول</h1>
          <ActionForm action={loginAction} className="space-y-4">
            <Field label="البريد الإلكتروني">
              <Input type="email" name="email" dir="ltr" autoComplete="username" required autoFocus />
            </Field>
            <Field label="كلمة المرور">
              <Input type="password" name="password" dir="ltr" autoComplete="current-password" required />
            </Field>
            <SubmitButton variant="dark" className="w-full">
              دخول
            </SubmitButton>
          </ActionForm>
        </div>
      </div>
    </main>
  );
}
