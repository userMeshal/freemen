"use client";

import { startTransition, useActionState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { TLink } from "@/components/site/Transition";
import { loginAction, registerAction, updateProfileAction, type AuthState } from "./actions";

/** نستدعي الإجراء يدويًا حتى لا يمسح React الحقول بعد رسالة خطأ */
function keep(action: (fd: FormData) => void) {
  return (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => action(fd));
  };
}

function Alert({ state }: { state: AuthState }) {
  if (state.error)
    return (
      <p role="alert" className="rounded-2xl bg-coral/15 px-4 py-3 text-sm text-[#a3200a]">
        {state.error}
      </p>
    );
  if (state.ok)
    return (
      <p role="status" className="rounded-2xl bg-lime/60 px-4 py-3 text-sm">
        {state.ok}
      </p>
    );
  return null;
}

function Input({ label, name, error, ...rest }: { label: string; name: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={`a-${name}`} className="label">
        {label}
      </label>
      <input id={`a-${name}`} name={name} className="field" aria-invalid={!!error} {...rest} />
      {error && <p className="mt-1.5 text-sm text-coral">{error}</p>}
    </div>
  );
}

export function LoginForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(loginAction, {});
  return (
    <form onSubmit={keep(action)} className="space-y-4">
      <Alert state={state} />
      <Input label="البريد الإلكتروني" name="email" type="email" dir="ltr" autoComplete="email" required />
      <Input label="كلمة المرور" name="password" type="password" dir="ltr" autoComplete="current-password" required />
      <button className="btn btn-ink w-full !min-h-[3.6rem]" disabled={pending}>
        {pending && <Loader2 size={18} className="animate-spin" />} تسجيل الدخول
      </button>
      <p className="text-center text-sm text-ink-mute">
        ليس لديك حساب؟{" "}
        <TLink href="/account/register" className="link-draw font-semibold text-ink">
          أنشئ حسابًا
        </TLink>
      </p>
    </form>
  );
}

export function RegisterForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(registerAction, {});
  return (
    <form onSubmit={keep(action)} className="space-y-4">
      <Alert state={state} />
      <Input label="الاسم الكامل" name="name" autoComplete="name" required error={state.fields?.name} />
      <Input label="رقم الجوال" name="phone" dir="ltr" inputMode="tel" placeholder="05XXXXXXXX" autoComplete="tel" required error={state.fields?.phone} />
      <Input label="البريد الإلكتروني" name="email" type="email" dir="ltr" autoComplete="email" required error={state.fields?.email} />
      <Input label="كلمة المرور" name="password" type="password" dir="ltr" autoComplete="new-password" minLength={8} required error={state.fields?.password} />
      <button className="btn btn-ink w-full !min-h-[3.6rem]" disabled={pending}>
        {pending && <Loader2 size={18} className="animate-spin" />} إنشاء الحساب
      </button>
      <p className="text-center text-sm text-ink-mute">
        لديك حساب؟{" "}
        <TLink href="/account/login" className="link-draw font-semibold text-ink">
          سجّل الدخول
        </TLink>
      </p>
    </form>
  );
}

export function ProfileForm({ name }: { name: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(updateProfileAction, {});
  return (
    <form onSubmit={keep(action)} className="space-y-4">
      <Alert state={state} />
      <Input label="الاسم" name="name" defaultValue={name} required />
      <Input label="كلمة المرور الحالية" name="currentPassword" type="password" dir="ltr" autoComplete="current-password" />
      <Input label="كلمة مرور جديدة (اختياري)" name="newPassword" type="password" dir="ltr" autoComplete="new-password" minLength={8} />
      <button className="btn btn-ink" disabled={pending}>
        {pending && <Loader2 size={18} className="animate-spin" />} حفظ
      </button>
    </form>
  );
}
