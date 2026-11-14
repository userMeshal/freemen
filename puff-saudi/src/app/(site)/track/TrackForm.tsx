"use client";

import { startTransition, useActionState } from "react";
import { Loader2 } from "lucide-react";
import { trackAction, type TrackState } from "./actions";

export function TrackForm() {
  const [state, action, pending] = useActionState<TrackState, FormData>(trackAction, {});
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
      }}
      className="max-w-xl space-y-4"
    >
      <div>
        <label htmlFor="t-number" className="label">
          رقم الطلب
        </label>
        <input id="t-number" name="number" className="field text-end" dir="ltr" placeholder="PF100123" required autoComplete="off" />
      </div>
      <div>
        <label htmlFor="t-phone" className="label">
          رقم الجوال المستخدم في الطلب
        </label>
        <input id="t-phone" name="phone" className="field text-end" dir="ltr" inputMode="tel" placeholder="05XXXXXXXX" required autoComplete="tel" />
      </div>
      {state.error && (
        <p role="alert" className="rounded-2xl bg-coral/15 px-4 py-3 text-sm text-[#a3200a]">
          {state.error}
        </p>
      )}
      <button className="btn btn-ink !min-h-[3.6rem] !px-9" disabled={pending}>
        {pending && <Loader2 size={18} className="animate-spin" />} تتبّع الطلب
      </button>
    </form>
  );
}
