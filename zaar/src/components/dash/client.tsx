"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Check, Copy, Loader2 } from "lucide-react";

export type ActionState = { ok: boolean; error?: string; message?: string } | null;
export type FormAction = (prev: ActionState, form: FormData) => Promise<ActionState>;

/** نموذج مربوط بإجراء خادم: يعرض الخطأ أو رسالة النجاح ويعطّل الزر أثناء الإرسال */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  onSuccess,
}: {
  action: FormAction;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  onSuccess?: () => void;
}) {
  const [state, run] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) {
      if (resetOnSuccess) ref.current?.reset();
      onSuccess?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  return (
    <form ref={ref} action={run} className={className}>
      {children}
      {state && !state.ok && state.error && (
        <p role="alert" className="mt-3 rounded-2xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-700">
          {state.error}
        </p>
      )}
      {state?.ok && state.message && (
        <p role="status" className="mt-3 flex items-center gap-2 rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700">
          <Check size={16} /> {state.message}
        </p>
      )}
    </form>
  );
}

export function Submit({ children, className = "dash-btn dash-btn-ink", pendingText }: { children: ReactNode; className?: string; pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending && <Loader2 size={16} className="animate-spin" />}
      {pending && pendingText ? pendingText : children}
    </button>
  );
}

/** زر إجراء واحد بتأكيد اختياري (حذف، تغيير حالة…) */
export function ActionButton({
  action,
  fields,
  children,
  className = "dash-btn dash-btn-ghost dash-btn-sm",
  confirm,
}: {
  action: FormAction;
  fields: Record<string, string | number>;
  children: ReactNode;
  className?: string;
  confirm?: string;
}) {
  const [state, run] = useActionState(action, null);
  return (
    <form
      action={run}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
      className="inline-flex flex-col items-start gap-1"
    >
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={String(v)} />
      ))}
      <Submit className={className}>{children}</Submit>
      {state && !state.ok && state.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}

export function CopyButton({ value, label = "نسخ" }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="dash-btn dash-btn-ghost dash-btn-sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1600);
        } catch {}
      }}
    >
      {done ? <Check size={14} /> : <Copy size={14} />}
      {done ? "تم النسخ" : label}
    </button>
  );
}
