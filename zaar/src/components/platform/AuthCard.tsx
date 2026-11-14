"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import type { AuthState } from "@/app/auth-actions";

function Go({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-accent mt-2 w-full !min-h-[3.6rem] !text-base">
      {pending && <Loader2 size={18} className="animate-spin" />} {children}
    </button>
  );
}

/** بطاقة الدخول/التسجيل — الحقول مضبوطة الحالة حتى لا تُمسح عند ظهور خطأ */
export function AuthCard({
  mode,
  action,
  draftName,
}: {
  mode: "login" | "signup";
  action: (prev: AuthState, form: FormData) => Promise<AuthState>;
  draftName?: string | null;
}) {
  const [state, run] = useActionState(action, null);
  const [v, setV] = useState({ name: "", phone: "", password: "" });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV((x) => ({ ...x, [k]: e.target.value }));
  const input = "w-full min-h-[3.4rem] rounded-2xl border border-paper/15 bg-paper/[0.06] px-4 text-paper outline-none transition-colors placeholder:text-paper/30 focus:border-accent";
  const signup = mode === "signup";

  return (
    <main className="relative grid min-h-[100dvh] place-items-center overflow-hidden bg-ink px-5 py-10 text-paper">
      <span className="z-glow -right-32 -top-40 h-[28rem] w-[28rem]" aria-hidden />
      <div className="relative w-full max-w-md">
        <Link href="/" className="font-display text-4xl font-black">
          زار
        </Link>
        <h1 className="t-h2 mt-8 !text-[clamp(1.8rem,6vw,2.6rem)]">{signup ? (draftName ? <>انشر «{draftName}»</> : "افتح حسابك") : "هلا من جديد"}</h1>
        <p className="mt-3 text-sm leading-relaxed text-paper/60">
          {signup
            ? draftName
              ? "خطوة وحدة وتصير صاحب المتجر: ينتشر فورًا ويبدأ يستقبل الطلبات."
              : "سجّل حسابك ثم ابنِ متجرك بالمحادثة."
            : "ادخل لوحة التحكم وتابع طلباتك وأرباحك."}
        </p>

        <form action={run} className="mt-8 space-y-4">
          {signup && (
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-paper/70">اسمك</span>
              <input name="name" required minLength={3} maxLength={60} autoComplete="name" value={v.name} onChange={set("name")} className={input} />
            </label>
          )}
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-paper/70">رقم الجوال</span>
            <input name="phone" required inputMode="tel" autoComplete="tel" placeholder="05XXXXXXXX" dir="ltr" value={v.phone} onChange={set("phone")} className={`${input} text-end`} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-paper/70">كلمة المرور</span>
            <input name="password" type="password" required minLength={signup ? 8 : 1} autoComplete={signup ? "new-password" : "current-password"} dir="ltr" value={v.password} onChange={set("password")} className={`${input} text-end`} />
            {signup && <span className="mt-1.5 block text-xs text-paper/40">8 أحرف على الأقل</span>}
          </label>
          {state?.error && (
            <p role="alert" className="rounded-2xl bg-coral/15 px-4 py-3 text-sm font-medium text-[#ff8a73]">
              {state.error}
            </p>
          )}
          <Go>{signup ? (draftName ? "انشر متجري" : "أنشئ الحساب") : "دخول"}</Go>
        </form>

        <p className="mt-6 text-center text-sm text-paper/55">
          {signup ? (
            <>
              عندك حساب؟{" "}
              <Link href="/login" className="font-semibold text-accent underline-offset-4 hover:underline">
                سجّل دخولك
              </Link>
            </>
          ) : (
            <>
              ما عندك متجر؟{" "}
              <Link href="/start" className="font-semibold text-accent underline-offset-4 hover:underline">
                ابنِ متجرك في ثوانٍ
              </Link>
            </>
          )}
        </p>
        {signup && <p className="mt-4 text-center text-xs leading-relaxed text-paper/35">بإنشاء الحساب توافق على شروط استخدام منصة زار وسياسة ضمان زار.</p>}
      </div>
    </main>
  );
}
