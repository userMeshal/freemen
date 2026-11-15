import { asc } from "drizzle-orm";
import { CheckCircle2, XCircle } from "lucide-react";
import { db } from "@/db";
import { admins } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { edfapayConfigured, getSettings, moyasarKeysPresent, siteUrl } from "@/lib/settings";
import { listWebhooks, MoyasarIpNotAllowedError, moyasarMode, moyasarOutboundIp, moyasarProxyConfigured } from "@/lib/moyasar";
import { readTelegram, telegramLink } from "@/lib/telegram";
import { fmtDate, halalasToInput } from "@/lib/admin-utils";
import { Badge, btnCls, Card, Checkbox, Field, Input, PageHeader, Textarea } from "@/components/admin/ui";
import { ActionForm, ConfirmButton, CopyField, SubmitButton } from "@/components/admin/client";
import {
  addAdminAction,
  changePasswordAction,
  connectMoyasarWebhookAction,
  disconnectTelegramAction,
  linkTelegramAction,
  removeAdminAction,
  removeTelegramChatAction,
  saveMarketingAction,
  savePaymentAction,
  saveStoreInfoAction,
  saveTelegramTokenAction,
  testTelegramAction,
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
  const [s, adminRows, telegram] = await Promise.all([
    getSettings(),
    db.select().from(admins).orderBy(asc(admins.id)),
    readTelegram(),
  ]);

  const hasKey = edfapayConfigured();
  const hasSecret = Boolean(process.env.EDFAPAY_WEBHOOK_SECRET);
  const env = process.env.EDFAPAY_ENV === "production" ? "production" : "sandbox";
  const webhookUrl = `${siteUrl()}/api/webhooks/edfapay`;
  const hasBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  const hasMoyasar = moyasarKeysPresent();
  const mode = moyasarMode();
  const moyasarWebhookUrl = `${siteUrl()}/api/webhooks/moyasar`;
  // حالة ربط الإشعارات تُقرأ من حساب ميسر مباشرة (إن تعذّر الاتصال نعرضها «غير معروفة»)
  let moyasarWebhook: "verified" | "pending" | "missing" | "unknown" = "unknown";
  let moyasarIpBlocked = false;
  if (hasMoyasar) {
    try {
      const hook = (await listWebhooks()).find((w) => w.url === moyasarWebhookUrl);
      moyasarWebhook = !hook ? "missing" : hook.verified === false ? "pending" : "verified";
    } catch (e) {
      moyasarWebhook = "unknown";
      moyasarIpBlocked = e instanceof MoyasarIpNotAllowedError;
    }
  }
  // عند رفض العنوان (أو مع المفاتيح الحيّة) نعرض العنوان الذي يخرج منه الاتصال فعلًا لمطابقته مع قائمة ميسر
  const outboundIp = hasMoyasar && (moyasarIpBlocked || mode === "live") ? await moyasarOutboundIp() : null;
  const noPayment = !s.codEnabled && !(s.edfapayEnabled && hasKey) && !(s.moyasarEnabled && hasMoyasar);

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
              لا توجد وسيلة دفع متاحة للعملاء حاليًا. أضف مفاتيح ميسر (أو EdfaPay) في متغيرات البيئة أو فعّل الدفع عند الاستلام.
            </p>
          ) : null}
          <ActionForm action={savePaymentAction} className="space-y-4">
            <div className="rounded-xl border border-line p-4">
              <Checkbox name="moyasarEnabled" defaultChecked={s.moyasarEnabled} label={<strong>الدفع الإلكتروني عبر ميسر (Moyasar)</strong>} />
              <p className="mt-1.5 text-xs leading-relaxed text-ink-mute">
                مدى، فيزا وماستركارد داخل الموقع. له الأولوية على EdfaPay عندما تكون مفاتيحه مضبوطة.
              </p>
              <div className="mt-3 space-y-2 border-t border-line pt-3">
                <Checkbox name="moyasarApplePay" defaultChecked={s.moyasarApplePay} label="إظهار Apple Pay (بعد تسجيل الدومين في لوحة ميسر)" />
                <Checkbox name="moyasarStcPay" defaultChecked={s.moyasarStcPay} label="إظهار STC Pay (إن كان مفعّلًا في حسابك لدى ميسر)" />
              </div>
              <Field
                label="ملف التحقق من دومين Apple Pay"
                className="mt-3"
                hint="من لوحة ميسر ← Apple Pay Domains: أضف الدومين، نزّل ملف التحقق، افتحه والصق محتواه هنا ثم احفظ، ثم اضغط Validate في لوحة ميسر."
              >
                <Textarea name="applePayDomainFile" dir="ltr" rows={3} defaultValue={s.applePayDomainFile} className="font-mono text-[11px]" />
              </Field>
            </div>
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
          title="حالة ربط ميسر (Moyasar)"
          actions={
            hasMoyasar ? (
              <Badge tone={mode === "live" ? "green" : "amber"}>{mode === "live" ? "مفاتيح حيّة (Live)" : mode === "test" ? "مفاتيح اختبار (Test)" : "مفاتيح غير معروفة النوع"}</Badge>
            ) : null
          }
        >
          <ul className="space-y-2">
            <Check ok={Boolean((process.env.MOYASAR_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY || "").trim())}>
              المفتاح العام <code dir="ltr" className="rounded bg-paper-deep px-1.5 py-0.5 text-xs">MOYASAR_PUBLISHABLE_KEY</code>
            </Check>
            <Check ok={Boolean((process.env.MOYASAR_SECRET_KEY || "").trim())}>
              المفتاح السري <code dir="ltr" className="rounded bg-paper-deep px-1.5 py-0.5 text-xs">MOYASAR_SECRET_KEY</code>
            </Check>
            <Check ok={s.moyasarEnabled}>الدفع عبر ميسر {s.moyasarEnabled ? "مفعّل" : "متوقف"} من إعدادات المتجر</Check>
            {mode === "live" || moyasarProxyConfigured() ? (
              <Check ok={moyasarProxyConfigured() && !moyasarIpBlocked}>
                عنوان IP ثابت للاتصال بميسر <code dir="ltr" className="rounded bg-paper-deep px-1.5 py-0.5 text-xs">MOYASAR_PROXY_URL</code>{" "}
                {moyasarProxyConfigured() ? "مضبوط" : "غير مضبوط"}
              </Check>
            ) : null}
            <Check ok={moyasarWebhook === "verified"}>
              إشعارات الدفع (Webhook):{" "}
              {moyasarWebhook === "verified"
                ? "مربوطة ومفعّلة"
                : moyasarWebhook === "pending"
                  ? "مسجّلة وبانتظار التفعيل"
                  : moyasarWebhook === "missing"
                    ? "غير مربوطة بعد"
                    : hasMoyasar
                      ? "تعذّر قراءة الحالة من ميسر"
                      : "تحتاج المفاتيح أولًا"}
            </Check>
          </ul>
          {moyasarIpBlocked ? (
            <p className="mt-4 rounded-xl bg-coral/10 px-3.5 py-2.5 text-sm font-medium leading-7 text-coral">
              ميسر رفض الاتصال لأن عنوان IP الخادم غير مضاف في «عناوين IP المسموحة» للمفتاح السري. المفاتيح الحيّة تحتاج عنوانًا ثابتًا: اضبط{" "}
              <code dir="ltr">MOYASAR_PROXY_URL</code> بوسيط ذي عنوان ثابت وأضف عنوانه في لوحة ميسر.
            </p>
          ) : null}
          {outboundIp ? (
            <p className="mt-3 text-sm">
              العنوان الذي يخرج منه الاتصال بميسر الآن:{" "}
              <code dir="ltr" className="rounded bg-paper-deep px-2 py-1 font-semibold">
                {outboundIp}
              </code>{" "}
              <span className="text-xs text-ink-mute">— يجب أن يكون ضمن «عناوين IP المسموحة» في لوحة ميسر (البيئة الفعلية).</span>
            </p>
          ) : hasMoyasar && (moyasarIpBlocked || mode === "live") ? (
            <p className="mt-3 text-sm text-coral">تعذّر معرفة عنوان الخروج — تحقق من صحة رابط الوسيط (اسم المستخدم وكلمة المرور).</p>
          ) : null}
          {hasMoyasar && moyasarWebhook !== "verified" ? (
            <ActionForm action={connectMoyasarWebhookAction} className="mt-4">
              <SubmitButton variant="dark" size="sm">
                ربط إشعارات ميسر تلقائيًا
              </SubmitButton>
            </ActionForm>
          ) : null}
          <p className="mt-3 text-[11px] leading-relaxed text-ink-mute">
            المفاتيح تُضاف كمتغيرات بيئة في Vercel ثم يُعاد النشر. الدفع يُؤكَّد عند عودة العميل للموقع، والإشعارات احتياط لمن يغلق المتصفح قبل
            العودة. رابط الإشعارات: <code dir="ltr">{moyasarWebhookUrl}</code>
          </p>
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

        <Card
          title="إشعارات الطلبات على الجوال (تيليجرام)"
          className="xl:col-span-2"
          actions={
            <Badge tone={telegram?.chats.length ? "green" : "amber"}>
              {telegram?.chats.length ? "مفعّلة" : telegram ? "بانتظار ربط الجوال" : "غير مفعّلة"}
            </Badge>
          }
        >
          <p className="text-sm leading-relaxed text-ink-mute">
            يصلك إشعار فوري على تيليجرام مع كل طلب مؤكَّد (مدفوع إلكترونيًا أو دفع عند الاستلام): رقم الطلب، المبلغ، العميل، المنتجات ورابط
            الطلب. الطلبات التي لم يكتمل دفعها لا تُرسَل.
          </p>

          {!telegram ? (
            <>
              <ol className="mt-4 list-decimal space-y-1.5 pr-5 text-sm leading-relaxed">
                <li>
                  افتح تيليجرام وابحث عن <code dir="ltr">@BotFather</code> (عليه علامة التوثيق الزرقاء) واضغط Start.
                </li>
                <li>
                  أرسل له <code dir="ltr">/newbot</code> ثم اكتب اسمًا للبوت (مثل: طلبات بف)، ثم اسم مستخدم بالإنجليزية ينتهي بـ{" "}
                  <code dir="ltr">bot</code> (مثل: <code dir="ltr">puff_orders_bot</code>).
                </li>
                <li>سيعطيك رمزًا طويلًا — انسخه والصقه هنا.</li>
              </ol>
              <ActionForm action={saveTelegramTokenAction} className="mt-4 max-w-xl" resetOnSuccess>
                <Field label="رمز البوت (Token)" hint="يُحفظ في المتجر ولا يُعرض بعد الحفظ.">
                  <Input name="botToken" type="password" dir="ltr" autoComplete="off" required placeholder="123456789:AA…" />
                </Field>
                <SubmitButton variant="dark" className="mt-3">
                  حفظ البوت
                </SubmitButton>
              </ActionForm>
            </>
          ) : (
            <>
              <p className="mt-4 text-sm">
                البوت: <code dir="ltr" className="rounded bg-paper-deep px-2 py-1 font-semibold">@{telegram.botUsername}</code>
              </p>

              {telegram.chats.length ? (
                <ul className="mt-4 divide-y divide-line/70 rounded-xl border border-line">
                  {telegram.chats.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                      <span className="min-w-0 truncate font-semibold">{c.name}</span>
                      <ActionForm action={removeTelegramChatAction} flashClassName="hidden">
                        <input type="hidden" name="chatId" value={c.id} />
                        <ConfirmButton message={`إيقاف الإشعارات عن «${c.name}»؟`}>إزالة</ConfirmButton>
                      </ActionForm>
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="mt-4 rounded-xl bg-paper-card p-4">
                <p className="text-sm font-semibold">{telegram.chats.length ? "ربط جوال آخر أو قروب" : "اربط جوالك — خطوتان"}</p>
                <ol className="mt-2 list-decimal space-y-1 pr-5 text-sm leading-relaxed text-ink-mute">
                  <li>افتح البوت من الزر التالي على الجوال الذي تريد أن تصله الإشعارات، واضغط Start.</li>
                  <li>ارجع إلى هنا واضغط «أكملت — اربط جوالي».</li>
                </ol>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <a href={telegramLink(telegram)} target="_blank" rel="noopener noreferrer" className={btnCls("primary", "sm")} data-telegram-link>
                    فتح البوت في تيليجرام
                  </a>
                  <a href={telegramLink(telegram, true)} target="_blank" rel="noopener noreferrer" className={btnCls("outline", "sm")}>
                    إضافته إلى قروب
                  </a>
                </div>
                <ActionForm action={linkTelegramAction} className="mt-3">
                  <SubmitButton variant="dark" size="sm">
                    أكملت — اربط جوالي
                  </SubmitButton>
                </ActionForm>
                <p className="mt-3 text-[11px] leading-relaxed text-ink-mute">
                  هذا الرابط خاص بك — لا ترسله إلا لمن تريد أن تصله إشعارات الطلبات.
                </p>
              </div>

              <div className="mt-4 flex flex-wrap items-start gap-3">
                {telegram.chats.length ? (
                  <ActionForm action={testTelegramAction}>
                    <SubmitButton variant="outline" size="sm">
                      إرسال إشعار تجريبي
                    </SubmitButton>
                  </ActionForm>
                ) : null}
                <ActionForm action={disconnectTelegramAction}>
                  <ConfirmButton message="فصل تيليجرام وحذف رمز البوت؟ ستتوقف كل الإشعارات.">فصل تيليجرام</ConfirmButton>
                </ActionForm>
              </div>
            </>
          )}
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
