"use client";

import { useMemo, useState } from "react";
import type { AdminAction } from "@/lib/admin-utils";
import { sanitizeHtml } from "@/lib/normalize";
import { Field, Input, Textarea } from "./ui";
import { ActionForm, SubmitButton } from "./client";

export function PageEditor({
  slug,
  title,
  bodyHtml,
  action,
}: {
  slug: string;
  title: string;
  bodyHtml: string;
  action: AdminAction;
}) {
  const [t, setT] = useState(title);
  const [body, setBody] = useState(bodyHtml);
  const preview = useMemo(() => sanitizeHtml(body), [body]);

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <ActionForm action={action} className="space-y-4">
        <input type="hidden" name="slug" value={slug} />
        <Field label="عنوان الصفحة">
          <Input name="title" value={t} onChange={(e) => setT(e.target.value)} required maxLength={160} />
        </Field>
        <Field
          label="المحتوى (HTML)"
          hint="الوسوم المسموحة: ‎<h2> <h3> <p> <strong> <em> <ul> <ol> <li> <br> <blockquote>‎ — أي وسوم أخرى تُحذف عند الحفظ."
        >
          <Textarea name="bodyHtml" dir="auto" rows={18} value={body} onChange={(e) => setBody(e.target.value)} className="font-mono !text-xs !leading-6" />
        </Field>
        <SubmitButton>حفظ ونشر</SubmitButton>
      </ActionForm>

      <div>
        <div className="mb-1.5 text-xs font-semibold text-ink-mute">معاينة مباشرة</div>
        <div className="max-h-[640px] overflow-y-auto rounded-2xl border border-line bg-paper-card p-6">
          <h1 className="mb-4 font-display text-2xl font-extrabold">{t || "بدون عنوان"}</h1>
          <div
            className="space-y-3 text-sm leading-8 text-ink [&_h2]:mt-6 [&_h2]:text-base [&_h2]:font-bold [&_h3]:mt-4 [&_h3]:font-bold [&_li]:ms-5 [&_ol]:list-decimal [&_ul]:list-disc"
            dangerouslySetInnerHTML={{ __html: preview }}
          />
        </div>
      </div>
    </div>
  );
}
