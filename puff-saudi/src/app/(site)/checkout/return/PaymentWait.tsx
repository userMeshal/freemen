"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, XCircle } from "lucide-react";
import { TLink, usePageTransition } from "@/components/site/Transition";
import { paymentStatusAction, retryPaymentAction } from "../actions";

export function PaymentWait({ number, token, failedHint }: { number: string; token: string; failedHint: boolean }) {
  const { navigate } = usePageTransition();
  const [state, setState] = useState<"waiting" | "failed" | "timeout">(failedHint ? "failed" : "waiting");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    let tries = 0;
    let stopped = false;
    const tick = async () => {
      if (stopped) return;
      tries++;
      const res = await paymentStatusAction({ number, token }).catch(() => null);
      if (stopped) return;
      if (res?.found && res.paymentStatus === "paid") {
        stopped = true;
        navigate(`/order/${number}?t=${token}&new=1`);
        return;
      }
      if (res?.found && res.paymentStatus === "failed") setState("failed");
      else if (tries >= 20) setState((s) => (s === "waiting" ? "timeout" : s));
      if (tries < 40) setTimeout(tick, 2500);
    };
    const t = setTimeout(tick, 1200);
    return () => {
      stopped = true;
      clearTimeout(t);
    };
  }, [number, token, navigate]);

  const retry = () =>
    start(async () => {
      setError(null);
      const res = await retryPaymentAction({ number, token });
      if (res.ok) {
        if (res.external) window.location.href = res.redirect;
        else navigate(res.redirect);
      } else setError(res.error);
    });

  return (
    <div className="max-w-lg text-center">
      {state === "waiting" ? (
        <>
          <Loader2 size={44} className="mx-auto animate-spin" />
          <h1 className="t-h2 mt-6">نتأكد من عملية الدفع…</h1>
          <p className="mt-3 leading-loose text-ink-mute">لحظات ونعرض لك تأكيد طلبك. لا تغلق هذه الصفحة.</p>
        </>
      ) : state === "failed" ? (
        <>
          <XCircle size={48} className="mx-auto text-coral" />
          <h1 className="t-h2 mt-6">لم تكتمل عملية الدفع</h1>
          <p className="mt-3 leading-loose text-ink-mute">
            لم يُخصم أي مبلغ. طلبك رقم <span className="num font-semibold text-ink">{number}</span> محفوظ ويمكنك إعادة المحاولة.
          </p>
        </>
      ) : (
        <>
          <h1 className="t-h2">ما زلنا بانتظار تأكيد الدفع</h1>
          <p className="mt-3 leading-loose text-ink-mute">
            إن أتممت الدفع فسيتحدّث طلبك رقم <span className="num font-semibold text-ink">{number}</span> تلقائيًا خلال دقائق. يمكنك متابعة حالته من صفحة الطلب.
          </p>
        </>
      )}
      {error && (
        <p role="alert" className="mt-4 text-sm text-coral">
          {error}
        </p>
      )}
      {state !== "waiting" && (
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={retry} disabled={pending} className="btn btn-ink">
            {pending ? <Loader2 size={18} className="animate-spin" /> : null} إعادة محاولة الدفع
          </button>
          <TLink href={`/order/${number}?t=${token}`} className="btn btn-ghost">
            صفحة الطلب
          </TLink>
        </div>
      )}
    </div>
  );
}
