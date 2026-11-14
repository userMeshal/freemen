"use client";

import {
  createContext,
  useActionState,
  useContext,
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
} from "react";
import { useFormStatus } from "react-dom";
import clsx from "clsx";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import type { ActionState, AdminAction } from "@/lib/admin-utils";
import { btnCls, type BtnVariant } from "./ui";

const PendingContext = createContext<boolean | null>(null);

export function Flash({ state, className }: { state: ActionState; className?: string }) {
  if (!state) return null;
  return (
    <p
      role={state.ok ? "status" : "alert"}
      className={clsx(
        "flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium",
        state.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700",
        className,
      )}
    >
      {state.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
      <span>{state.message}</span>
    </p>
  );
}

/**
 * نموذج يستدعي server action ويعرض رسالة النجاح/الخطأ.
 * يُستدعى الإجراء يدويًا (لا عبر form action) حتى لا يمسح React مدخلات المستخدم عند خطأ التحقق.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  flashClassName,
}: {
  action: AdminAction;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  flashClassName?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (submitter?.name) fd.set(submitter.name, submitter.value);
    startTransition(() => formAction(fd));
  }

  return (
    <PendingContext.Provider value={pending}>
      <form ref={ref} onSubmit={onSubmit} className={className} noValidate={false}>
        {children}
        <Flash state={state} className={clsx("mt-3", flashClassName)} />
      </form>
    </PendingContext.Provider>
  );
}

export function SubmitButton({
  children,
  variant = "primary",
  size = "md",
  className,
  name,
  value,
}: {
  children: ReactNode;
  variant?: BtnVariant;
  size?: "sm" | "md";
  className?: string;
  name?: string;
  value?: string;
}) {
  const ctx = useContext(PendingContext);
  const status = useFormStatus();
  const pending = ctx ?? status.pending;
  return (
    <button type="submit" name={name} value={value} disabled={pending} className={clsx(btnCls(variant, size), className)}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  );
}

export function ConfirmButton({
  children,
  message,
  variant = "danger",
  size = "sm",
  className,
  name,
  value,
}: {
  children: ReactNode;
  message: string;
  variant?: BtnVariant;
  size?: "sm" | "md";
  className?: string;
  name?: string;
  value?: string;
}) {
  const ctx = useContext(PendingContext);
  const status = useFormStatus();
  const pending = ctx ?? status.pending;
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      className={clsx(btnCls(variant, size), className)}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
      {children}
    </button>
  );
}

/** مربع "تحديد الكل" لمجموعة checkboxes داخل نفس النموذج */
export function SelectAll({ name, label = "تحديد الكل" }: { name: string; label?: string }) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      className="h-4 w-4 rounded border-line accent-ink"
      onChange={(e) => {
        const form = e.currentTarget.closest("form");
        form?.querySelectorAll<HTMLInputElement>(`input[type="checkbox"][name="${name}"]`).forEach((c) => {
          c.checked = e.currentTarget.checked;
        });
      }}
    />
  );
}

export function CopyField({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-stretch gap-2">
      <input
        readOnly
        dir="ltr"
        value={value}
        aria-label={label}
        onFocus={(e) => e.currentTarget.select()}
        className="block w-full rounded-xl border border-line bg-paper-card px-3.5 py-2.5 text-left font-mono text-xs text-ink outline-none"
      />
      <button
        type="button"
        className={btnCls("outline", "sm")}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          } catch {
            /* المتصفح منع النسخ — يمكن التحديد يدويًا */
          }
        }}
      >
        {copied ? "تم النسخ" : "نسخ"}
      </button>
    </div>
  );
}
