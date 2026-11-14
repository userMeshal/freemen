"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { trackOrderAction } from "@/app/s/[store]/actions";
import { useHref, useNavigate, useStore } from "./ctx";
import { PageTitle, useT } from "./ui";

export function TrackForm() {
  const { store } = useStore();
  const t = useT();
  const href = useHref();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setErr(null);
    const r = await trackOrderAction(store.slug, String(f.get("number") ?? ""), String(f.get("phone") ?? ""));
    setBusy(false);
    if (r.ok) navigate(href(r.url));
    else setErr(r.error);
  };

  return (
    <div className={t.page}>
      <div className="mx-auto max-w-lg">
        <PageTitle eyebrow={store.name} title="تتبّع طلبك">
          <p className={`mt-3 ${t.lead}`}>اكتب رقم الطلب ورقم الجوال اللي طلبت فيه. ومن صفحة الطلب تقدر تطلب استرداد المبلغ بضمان زار.</p>
        </PageTitle>
        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className={t.label}>رقم الطلب</span>
            <input name="number" required placeholder="ZR100001" dir="ltr" className={`${t.input} text-end`} />
          </label>
          <label className="block">
            <span className={t.label}>رقم الجوال</span>
            <input name="phone" required inputMode="tel" placeholder="05XXXXXXXX" dir="ltr" className={`${t.input} text-end`} />
          </label>
          {err && <p className={t.error}>{err}</p>}
          <button type="submit" disabled={busy} className={t.btnBlock}>
            {busy && <Loader2 size={18} className="animate-spin" />} اعرض الطلب
          </button>
        </form>
      </div>
    </div>
  );
}
