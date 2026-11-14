"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useRef, type ReactNode } from "react";
import { Check, Loader2 } from "lucide-react";
import type { FormAction } from "@/components/dash/client";

const Pending = createContext(false);

/**
 * مثل ActionForm لكنه لا يمسح ما كتبه التاجر إذا رجع الإجراء بخطأ
 * (React 19 يعيد ضبط النموذج بعد أي form action حتى لو فشل التحقق).
 * عند النجاح يُعاد الضبط إلى القيم المحفوظة القادمة من الخادم (إلا مع resetOnSuccess={false}).
 */
export function SafeForm({
  action,
  children,
  className,
  resetOnSuccess = true,
  onSuccess,
}: {
  action: FormAction;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  onSuccess?: () => void;
}) {
  const [state, run, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  const note = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (state?.ok) {
      if (resetOnSuccess) ref.current?.reset();
      onSuccess?.();
    }
    // في النماذج الطويلة قد تكون الرسالة خارج الشاشة
    note.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  return (
    <form
      ref={ref}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        if (pending) return;
        const data = new FormData(e.currentTarget);
        startTransition(() => run(data));
      }}
    >
      <Pending.Provider value={pending}>{children}</Pending.Provider>
      {!pending && state && !state.ok && state.error && (
        <p ref={note} role="alert" className="mt-3 rounded-2xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-700">
          {state.error}
        </p>
      )}
      {!pending && state?.ok && state.message && (
        <p ref={note} role="status" className="mt-3 flex items-center gap-2 rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700">
          <Check size={16} /> {state.message}
        </p>
      )}
    </form>
  );
}

export function SafeSubmit({ children, className = "dash-btn dash-btn-ink", pendingText }: { children: ReactNode; className?: string; pendingText?: string }) {
  const pending = useContext(Pending);
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending && <Loader2 size={16} className="animate-spin" />}
      {pending && pendingText ? pendingText : children}
    </button>
  );
}
