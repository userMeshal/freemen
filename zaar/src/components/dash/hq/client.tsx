"use client";

import { useActionState, useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import { Submit, type FormAction } from "@/components/dash/client";

/** نموذج إجراء مع تأكيد اختياري قبل الإرسال ورسالة نجاح/خطأ تحته */
export function HqForm({
  action,
  confirm,
  className,
  children,
}: {
  action: FormAction;
  confirm?: string;
  className?: string;
  children: ReactNode;
}) {
  const [state, run] = useActionState(action, null);
  return (
    <form
      action={run}
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
      {state && !state.ok && state.error && (
        <p role="alert" className="mt-2 rounded-2xl bg-red-500/10 px-3.5 py-2.5 text-xs font-medium leading-relaxed text-red-700">
          {state.error}
        </p>
      )}
      {state?.ok && state.message && (
        <p role="status" className="mt-2 flex items-start gap-2 rounded-2xl bg-emerald-500/10 px-3.5 py-2.5 text-xs font-medium leading-relaxed text-emerald-700">
          <Check size={15} className="mt-0.5 shrink-0" /> <span>{state.message}</span>
        </p>
      )}
    </form>
  );
}

/** إجراءات صف التحويل المعلّق: «تم التحويل» بمرجع بنكي، أو «فشل التحويل» بسبب */
export function PayoutActions({
  id,
  summary,
  sentAction,
  failedAction,
}: {
  id: number;
  /** وصف قصير يظهر في رسالة التأكيد: المبلغ واسم صاحب الحساب */
  summary: string;
  sentAction: FormAction;
  failedAction: FormAction;
}) {
  const [failing, setFailing] = useState(false);
  return (
    <div className="w-full max-w-lg space-y-2">
      {!failing ? (
        <HqForm action={sentAction} confirm={`تأكيد: تم تحويل ${summary}؟ لا يمكن التراجع بعد التأكيد.`}>
          <input type="hidden" name="id" value={id} />
          <label className="sr-only" htmlFor={`ref-${id}`}>
            مرجع الحوالة البنكية
          </label>
          <div className="flex gap-2">
            <input
              id={`ref-${id}`}
              name="reference"
              required
              minLength={3}
              maxLength={80}
              dir="ltr"
              autoComplete="off"
              placeholder="مرجع الحوالة البنكية"
              className="dash-input !min-h-[2.4rem] min-w-0 flex-1 !py-1.5 text-end placeholder:text-sm"
            />
            <Submit className="dash-btn dash-btn-ink dash-btn-sm shrink-0">تم التحويل</Submit>
          </div>
        </HqForm>
      ) : (
        <HqForm action={failedAction} confirm={`تأكيد فشل تحويل ${summary}؟ سيرجع المبلغ لرصيد التاجر.`}>
          <input type="hidden" name="id" value={id} />
          <label className="sr-only" htmlFor={`reason-${id}`}>
            سبب فشل التحويل
          </label>
          <div className="flex gap-2">
            <input
              id={`reason-${id}`}
              name="reason"
              required
              minLength={3}
              maxLength={80}
              autoComplete="off"
              placeholder="السبب (مثال: آيبان غير صحيح)"
              className="dash-input !min-h-[2.4rem] min-w-0 flex-1 !py-1.5 placeholder:text-sm"
            />
            <Submit className="dash-btn dash-btn-danger dash-btn-sm shrink-0">تأكيد الفشل</Submit>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-ink/55">يرجع المبلغ لرصيد التاجر ويدخل تلقائيًا في التحويل التالي.</p>
        </HqForm>
      )}
      <button type="button" onClick={() => setFailing((v) => !v)} className="text-xs font-medium text-ink/55 underline underline-offset-4 hover:text-ink">
        {failing ? "رجوع: تم التحويل" : "فشل التحويل؟"}
      </button>
    </div>
  );
}

/** قرار إدارة زار في طلب استرداد: استرداد كامل أو رفض بسبب يراه العميل */
export function ClaimDecision({ id, amountText, action }: { id: number; amountText: string; action: FormAction }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <HqForm
        action={action}
        confirm={`تأكيد استرداد ${amountText} كاملًا للعميل؟ يُخصم المبلغ من رصيد التاجر ولا يمكن التراجع.`}
        className="rounded-2xl border border-ink/10 bg-white/60 p-4"
      >
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="decision" value="approve" />
        <label className="dash-label" htmlFor={`approve-${id}`}>
          ملاحظة القرار (اختيارية)
        </label>
        <textarea id={`approve-${id}`} name="note" rows={2} maxLength={1000} className="dash-input" placeholder="تظهر للعميل والتاجر مع القرار" />
        <Submit className="dash-btn dash-btn-ink mt-3 w-full" pendingText="جارٍ الاسترداد…">
          استرداد كامل للعميل
        </Submit>
      </HqForm>
      <HqForm action={action} confirm="تأكيد رفض طلب الاسترداد؟ سيرى العميل سبب الرفض." className="rounded-2xl border border-ink/10 bg-white/60 p-4">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="decision" value="reject" />
        <label className="dash-label" htmlFor={`reject-${id}`}>
          سبب الرفض (يراه العميل)
        </label>
        <textarea id={`reject-${id}`} name="note" rows={2} required minLength={10} maxLength={1000} className="dash-input" placeholder="10 أحرف على الأقل" />
        <Submit className="dash-btn dash-btn-danger mt-3 w-full">رفض الطلب</Submit>
      </HqForm>
    </div>
  );
}
