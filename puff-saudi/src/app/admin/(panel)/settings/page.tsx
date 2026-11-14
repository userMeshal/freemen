import { asc } from "drizzle-orm";
import { CheckCircle2, XCircle } from "lucide-react";
import { db } from "@/db";
import { admins } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { edfapayConfigured, getSettings, siteUrl } from "@/lib/settings";
import { fmtDate, halalasToInput } from "@/lib/admin-utils";
import { Badge, Card, Checkbox, Field, Input, PageHeader } from "@/components/admin/ui";
import { ActionForm, ConfirmButton, CopyField, SubmitButton } from "@/components/admin/client";
import {
  addAdminAction,
  changePasswordAction,
  removeAdminAction,
  saveMarketingAction,
  savePaymentAction,
  saveStoreInfoAction,
} from "./actions";

export const metadata = { title: "الإعدادات" };

function Check({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      {ok ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> : <XCircle className="h-4 w-4 shrink-0 text-coral" />}
      <span>{children}</span>
    </li>
  );
}

export default async function AdminSettingsPage() {
  const me = await requireAdmin();
  const [s, adminRows] = await Promise.all([getSettings(), db.select().from(admins).orderBy(asc(admins.id))]);

  const hasKey = edfapayConfigured();
  const hasSecret = Boolean(process.env.EDFAPAY_WEBHOOK_SECRET);
  const env = process.env.EDFAPAY_ENV === "production" ? "production" : "sandbox";
  const webhookUrl = `${siteUrl()}/api/webhooks/edfapay`;
  const hasBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  const noPayment = !s.codEnabled && !(s.edfapayEnabled && hasKey);

  return (
    <>
      <PageHeader title="الإعدادات" subtitle="بيانات المتجر، الدفع، التتبع الإعلاني وحسابات المدراء" />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="بيانات المتجر" className="xl:col-span-2">
          <ActionForm action={saveStoreInfoAction}>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="اسم المتجر">
                <Input name="storeName" defaultValue={s.storeName} required maxLength={80} />
              </Field>
              <Field label="وصف مختصر (Tagline)" className="md:col-span-2">
                <Input name="tagline" defaultValue={s.tagline} maxLength={160} />
              </Field>
              <Field label="البريد الإلكتروني">
                <Input name="email" type="email" dir="ltr" defaultValue={s.email} />
              </Field>
              <Field label="الهاتف">
                <Input name="phone" dir="ltr" defaultValue={s.phone} placeholder="+966 5X XXX XXXX" />
              </Field>
              <Field label="واتساب" hint="أرقام مع مفتاح الدولة بدون + أو مسافات">
                <Input name="whatsapp" dir="ltr" defaultValue={s.whatsapp} placeholder="9665XXXXXXXX" />
              </Field>
              <Field label="إنستغرام">
                <Input name="instagram" dir="ltr" defaultValue={s.instagram} placeholder="https://instagram.com/…" />
              </Field>
              <Field label="تيك توك">
                <Input name="tiktok" dir="ltr" defaultValue={s.tiktok} placeholder="https://tiktok.com/@…" />
              </Field>
              <Field label="سناب شات">
                <Input name="snapchat" dir="ltr" defaultValue={s.snapchat} placeholder="https://snapchat.com/add/…" />
              </Field>
              <Field label="X (تويتر)">
                <Input name="x" dir="ltr" defaultValue={s.x} placeholder="https://x.com/…" />
              </Field>
              <Field label="السجل التجاري">
                <Input name="crNumber" dir="ltr" defaultValue={s.crNumber} />
              </Field>
              <Field label="الرقم الضريبي">
                <Input name="vatNumber" dir="ltr" defaultValue={s.vatNumber} />
              </Field>
              <Field label="نسبة ضريبة القيمة المضافة %" hint="الأسعار المعروضة شاملة للضريبة — تُستخدم لإظهار مبلغ الضريبة ضمن الإجمالي">
                <Input name="vatRate" dir="ltr" inputMode="decimal" defaultValue={s.vatRate} />
              </Field>
            </div>
            <div className="mt-4">
              <SubmitButton>حفظ بيانات المتجر</SubmitButton>
            </div>
          </ActionForm>
        </Card>

        <Card title="الشريط الإعلاني والتتبع (Pixels)">
          <ActionForm action={saveMarketingAction} className="space-y-4">
            <Field label="نص الشريط الإعلاني أعلى المتجر" hint="اتركه فارغًا لإخفاء الشريط">
              <Input name="announcement" defaultValue={s.announcement} maxLength={200} placeholder="مثال: شحن مجاني للطلبات فوق 300 ر.س" />
            </Field>
            <Field label="Meta Pixel ID" hint="من Meta Events Manager — أرقام فقط">
              <Input name="metaPixelId" dir="ltr" inputMode="numeric" defaultValue={s.metaPixelId} />
            </Field>
            <Field label="TikTok Pixel ID" hint="من TikTok Ads Manager ← Events">
              <Input name="tiktokPixelId" dir="ltr" defaultValue={s.tiktokPixelId} />
            </Field>
            <p className="text-[11px] leading-relaxed text-ink-mute">
              عند إضافة المعرّف تُرسل الأحداث تلقائيًا: PageView، ViewContent، AddToCart، InitiateCheckout، Purchase.
            </p>
            <SubmitButton>حفظ</SubmitButton>
          </ActionForm>
        </Card>

        <Card title="وسائل الدفع">
          {noPayment ? (
            <p className="mb-4 rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm font-medium leading-7 text-amber-800">
              لا توجد وسيلة دفع متاحة للعملاء حاليًا. أضف مفتاح EdfaPay في متغيرات البيئة أو فعّل الدفع عند الاستلام.
            </p>
          ) : null}
          <ActionForm action={savePaymentAction} className="space-y-4">
            <div className="rounded-xl border border-line p-4">
              <Checkbox name="edfapayEnabled" defaultChecked={s.edfapayEnabled} label={<strong>الدفع الإلكتروني عبر EdfaPay</strong>} />
              <p className="mt-1.5 text-xs leading-relaxed text-ink-mute">
                مدى، فيزا، ماستركارد و Apple Pay — تظهر في صفحة الدفع بحسب ما هو مفعّل في حسابك لدى EdfaPay.
              </p>
            </div>
            <div className="rounded-xl border border-line p-4">
              <Checkbox name="codEnabled" defaultChecked={s.codEnabled} label={<strong>الدفع عند الاستلام</strong>} />
              <Field label="رسوم الدفع عند الاستلام (ر.س)" className="mt-3 max-w-[220px]" hint="0 = بدون رسوم">
                <Input name="codFee" dir="ltr" inputMode="decimal" defaultValue={halalasToInput(s.codFee)} />
              </Field>
            </div>
            <SubmitButton>حفظ إعدادات الدفع</SubmitButton>
          </ActionForm>
        </Card>

        <Card
          title="حالة ربط EdfaPay"
          actions={<Badge tone={env === "production" ? "green" : "amber"}>{env === "production" ? "بيئة الإنتاج" : "بيئة الاختبار (Sandbox)"}</Badge>}
        >
          <ul className="space-y-2">
            <Check ok={hasKey}>
              مفتاح الـ API <code dir="ltr" className="rounded bg-paper-deep px-1.5 py-0.5 text-xs">EDFAPAY_API_KEY</code>{" "}
              {hasKey ? "مضبوط" : "غير مضبوط"}
            </Check>
            <Check ok={hasSecret}>
              سرّ الـ Webhook <code dir="ltr" className="rounded bg-paper-deep px-1.5 py-0.5 text-xs">EDFAPAY_WEBHOOK_SECRET</code>{" "}
              {hasSecret ? "مضبوط" : "غير مضبوط (يُنصح به بشدة للتحقق من توقيع الإشعارات)"}
            </Check>
            <Check ok={s.edfapayEnabled}>الدفع الإلكتروني {s.edfapayEnabled ? "مفعّل" : "متوقف"} من إعدادات المتجر</Check>
          </ul>
          <div className="mt-5">
            <div className="mb-1.5 text-xs font-semibold text-ink-mute">رابط الـ Webhook — ضعه في لوحة EdfaPay ← Configuration ← Webhook</div>
            <CopyField value={webhookUrl} label="رابط الـ Webhook" />
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-ink-mute">
            المفاتيح تُضبط كمتغيرات بيئة في Vercel (لا تُحفظ في قاعدة البيانات ولا تُعرض هنا). للتحويل إلى التشغيل الفعلي اضبط{" "}
            <code dir="ltr">EDFAPAY_ENV=production</code> مع مفتاح الإنتاج ثم أعد النشر.
          </p>
          <ul className="mt-4 space-y-2 border-t border-line pt-4">
            <Check ok={hasBlob}>
              رفع صور المنتجات (Vercel Blob) <code dir="ltr" className="rounded bg-paper-deep px-1.5 py-0.5 text-xs">BLOB_READ_WRITE_TOKEN</code>{" "}
              {hasBlob ? "مضبوط" : "غير مضبوط — الرفع يعمل محليًا فقط"}
            </Check>
          </ul>
        </Card>

        <Card title="تغيير كلمة المرور">
          <ActionForm action={changePasswordAction} resetOnSuccess className="space-y-4">
            <Field label="كلمة المرور الحالية">
              <Input name="current" type="password" dir="ltr" autoComplete="current-password" required />
            </Field>
            <Field label="كلمة المرور الجديدة" hint="10 أحرف على الأقل">
              <Input name="next" type="password" dir="ltr" autoComplete="new-password" required minLength={10} />
            </Field>
            <Field label="تأكيد كلمة المرور الجديدة">
              <Input name="confirm" type="password" dir="ltr" autoComplete="new-password" required minLength={10} />
            </Field>
            <SubmitButton variant="dark">تغيير كلمة المرور</SubmitButton>
          </ActionForm>
        </Card>

        <Card title="المدراء" className="xl:col-span-2">
          <ul className="divide-y divide-line/70">
            {adminRows.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="font-semibold">
                    {a.name} {a.id === me.id ? <Badge tone="lime">أنت</Badge> : null}
                  </div>
                  <div className="text-xs text-ink-mute">
                    <span dir="ltr">{a.email}</span> · أُضيف {fmtDate(a.createdAt)}
                  </div>
                </div>
                {a.id !== me.id ? (
                  <ActionForm action={removeAdminAction}>
                    <input type="hidden" name="id" value={a.id} />
                    <ConfirmButton message={`حذف المدير ${a.email}؟ سيفقد صلاحية الدخول فورًا.`}>حذف</ConfirmButton>
                  </ActionForm>
                ) : null}
              </li>
            ))}
          </ul>
          <ActionForm action={addAdminAction} resetOnSuccess className="mt-5 border-t border-line pt-5">
            <div className="mb-3 text-sm font-bold">إضافة مدير</div>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="الاسم">
                <Input name="name" required maxLength={80} />
              </Field>
              <Field label="البريد الإلكتروني">
                <Input name="email" type="email" dir="ltr" required autoComplete="off" />
              </Field>
              <Field label="كلمة المرور" hint="10 أحرف على الأقل">
                <Input name="password" type="password" dir="ltr" required minLength={10} autoComplete="new-password" />
              </Field>
            </div>
            <div className="mt-4">
              <SubmitButton variant="dark">إضافة المدير</SubmitButton>
            </div>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
