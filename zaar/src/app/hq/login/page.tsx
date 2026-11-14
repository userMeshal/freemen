import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { ActionForm, Submit } from "@/components/dash/client";
import { getHq } from "@/lib/auth";
import { loginHq } from "./actions";

export const metadata = { title: "دخول إدارة المنصة", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function HqLoginPage() {
  if (await getHq()) redirect("/hq");

  return (
    <main className="grid min-h-screen place-items-center bg-ink px-4 py-10 text-paper">
      <div className="w-full max-w-sm">
        <div className="mb-7 text-center">
          <p className="font-display text-6xl font-black leading-none">زار</p>
          <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-paper/10 px-4 py-1.5 text-sm font-semibold text-accent">
            <ShieldCheck size={16} /> إدارة المنصة
          </p>
        </div>

        <div className="rounded-[1.75rem] bg-paper p-6 text-ink shadow-2xl md:p-7">
          <h1 className="font-display text-lg font-extrabold">تسجيل الدخول</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-ink/60">هذه اللوحة خاصة بفريق زار.</p>

          <ActionForm action={loginHq} className="mt-5 space-y-4">
            <label className="block">
              <span className="dash-label">البريد الإلكتروني</span>
              <input name="email" type="email" required autoComplete="username" dir="ltr" inputMode="email" className="dash-input" />
            </label>
            <label className="block">
              <span className="dash-label">كلمة المرور</span>
              <input name="password" type="password" required autoComplete="current-password" dir="ltr" className="dash-input" />
            </label>
            <Submit className="dash-btn dash-btn-ink w-full" pendingText="جارٍ التحقق…">
              دخول
            </Submit>
          </ActionForm>
        </div>

        <p className="mt-6 text-center text-xs leading-relaxed text-paper/45">تنتهي الجلسة تلقائيًا بعد 12 ساعة.</p>
      </div>
    </main>
  );
}
