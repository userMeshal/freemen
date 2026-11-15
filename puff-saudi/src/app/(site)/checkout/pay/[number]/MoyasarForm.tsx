"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Lock } from "lucide-react";
import "moyasar-payment-form/dist/moyasar.css";
import { createMoyasarIntentAction, recordMoyasarPaymentAction } from "../../actions";

type MoyasarStatic = { init: (config: Record<string, unknown>) => void };

/**
 * نموذج ميسر الرسمي داخل الصفحة. بيانات البطاقة تذهب من المتصفح إلى ميسر مباشرة ولا تمر بخادمنا.
 * المبلغ والوصف يُقفلان على الخادم عبر Payment Intent يُنشأ لحظة ضغط «ادفع».
 */
export function MoyasarForm({
  number,
  token,
  amount,
  description,
  publishableKey,
  callbackUrl,
  methods,
  storeName,
}: {
  number: string;
  token: string;
  amount: number;
  description: string;
  publishableKey: string;
  callbackUrl: string;
  methods: string[];
  storeName: string;
}) {
  const started = useRef(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (started.current) return;
    // الحارس يمنع التهيئة المزدوجة (React StrictMode يشغّل التأثير مرتين في وضع التطوير)
    started.current = true;
    (async () => {
      try {
        const mod = (await import("moyasar-payment-form")) as unknown as { default?: MoyasarStatic } & MoyasarStatic;
        const Moyasar = mod.default ?? mod;
        Moyasar.init({
          element: ".mysr-form",
          language: "ar",
          amount,
          currency: "SAR",
          description,
          publishable_api_key: publishableKey,
          callback_url: callbackUrl,
          methods,
          supported_networks: ["mada", "visa", "mastercard"],
          apple_pay: {
            country: "SA",
            label: storeName,
            validate_merchant_url: "https://api.moyasar.com/v1/applepay/initiate",
          },
          use_payment_intent: true,
          on_initiating: async () => {
            setError(null);
            const res = await createMoyasarIntentAction({ number, token });
            if (!res.ok) {
              setError(res.error);
              throw new Error(res.error);
            }
            return { payment_intent: { id: res.id, client_secret: res.clientSecret } };
          },
          on_completed: async (payment: { id?: string }) => {
            if (payment?.id) await recordMoyasarPaymentAction({ number, token, paymentId: payment.id }).catch(() => {});
          },
          on_failure: async (message: unknown) => {
            setError(typeof message === "string" && message ? message : "تعذّر إتمام الدفع. تحقق من بيانات البطاقة ثم أعد المحاولة.");
          },
        });
        setReady(true);
      } catch (e) {
        console.error(e);
        setError("تعذّر تحميل نموذج الدفع. حدّث الصفحة ثم أعد المحاولة.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <p className="mb-5 flex items-center gap-2 text-sm text-ink-mute">
        <Lock size={15} /> دفع آمن عبر ميسر — بيانات بطاقتك لا تُحفظ في المتجر
      </p>
      {error && (
        <p role="alert" className="mb-4 rounded-2xl bg-coral/15 px-4 py-3 text-sm text-[#a3200a]">
          {error}
        </p>
      )}
      {!ready && !error && (
        <div className="grid h-64 place-items-center text-ink-mute" aria-busy="true">
          <Loader2 className="animate-spin" />
        </div>
      )}
      {/* dir=ltr لحقول البطاقة؛ النصوص يعرّبها النموذج نفسه */}
      <div className="mysr-form" />
    </div>
  );
}
