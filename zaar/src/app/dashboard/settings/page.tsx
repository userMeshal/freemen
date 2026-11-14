import { ExternalLink } from "lucide-react";
import { CopyButton, type FormAction } from "@/components/dash/client";
import { SafeForm, SafeSubmit } from "@/components/dash/merchant/SafeForm";
import { Badge, Card, Field, PageHead } from "@/components/dash/ui";
import { requireMerchantStore } from "@/lib/auth";
import { DEFAULT_SETTINGS, storePublicUrl } from "@/lib/stores";
import { sarInput } from "../_lib/form";
import { changePassword, saveContact, saveIdentity, saveLegal, savePixels, savePolicies, saveShipping } from "./actions";

export const metadata = { title: "الإعدادات" };

function Section({ title, hint, action, submit = "حفظ", children }: { title: string; hint?: string; action: FormAction; submit?: string; children: React.ReactNode }) {
  return (
    <Card title={title}>
      {hint && <p className="-mt-2 mb-4 text-xs leading-relaxed text-ink/55">{hint}</p>}
      <SafeForm action={action}>
        <div className="grid gap-4 sm:grid-cols-2">{children}</div>
        <div className="mt-5">
          <SafeSubmit pendingText="يحفظ…">{submit}</SafeSubmit>
        </div>
      </SafeForm>
    </Card>
  );
}

const STATUS = { live: { label: "منشور", tone: "good" }, draft: { label: "مسودة", tone: "warn" }, suspended: { label: "موقوف", tone: "bad" } } as const;

export default async function SettingsPage() {
  const { merchant, store } = await requireMerchantStore();
  const s = { ...DEFAULT_SETTINGS, ...store.settings };
  const url = storePublicUrl(store.slug);

  return (
    <>
      <PageHead title="الإعدادات" sub="بيانات متجرك اللي تظهر للعملاء، والشحن، والسياسات، وحسابك. كل قسم يُحفظ لحاله." />

      <div className="space-y-5">
        <Card title="رابط متجرك" action={<Badge tone={STATUS[store.status].tone}>{STATUS[store.status].label}</Badge>}>
          <div className="flex flex-wrap items-center gap-2">
            <code dir="ltr" className="num min-w-0 flex-1 truncate rounded-2xl bg-ink/[0.05] px-4 py-3 text-start text-sm">
              {url}
            </code>
            <CopyButton value={url} label="نسخ الرابط" />
            <a href={url} target="_blank" rel="noopener" className="dash-btn dash-btn-ghost dash-btn-sm">
              <ExternalLink size={14} /> فتح
            </a>
          </div>
        </Card>

        <Section title="هوية المتجر" action={saveIdentity}>
          <Field label="اسم المتجر">
            <input name="name" defaultValue={store.name} className="dash-input" required minLength={2} maxLength={60} />
          </Field>
          <Field label="الشعار اللفظي" hint="جملة قصيرة تحت اسم المتجر.">
            <input name="tagline" defaultValue={store.tagline} className="dash-input" maxLength={90} />
          </Field>
          <Field label="وصف المتجر" hint="يظهر في نتائج البحث وعند مشاركة رابط المتجر." className="sm:col-span-2">
            <textarea name="description" defaultValue={store.description} className="dash-input !min-h-24 leading-relaxed" maxLength={300} />
          </Field>
        </Section>

        <Section title="التواصل وحسابات السوشال" hint="تظهر للعملاء في متجرك. اترك أي حقل فاضي إذا ما تبيه يظهر." action={saveContact}>
          <Field label="البريد الإلكتروني">
            <input name="email" type="email" defaultValue={s.email} className="dash-input" dir="ltr" maxLength={120} autoComplete="off" />
          </Field>
          <Field label="رقم الجوال">
            <input name="phone" defaultValue={s.phone} className="dash-input num" dir="ltr" inputMode="tel" maxLength={25} placeholder="05XXXXXXXX" />
          </Field>
          <Field label="واتساب المتجر" hint="رقم يراسلك عليه العملاء.">
            <input name="whatsapp" defaultValue={s.whatsapp} className="dash-input num" dir="ltr" inputMode="tel" maxLength={25} placeholder="05XXXXXXXX" />
          </Field>
          <Field label="انستقرام" hint="اسم الحساب أو رابطه.">
            <input name="instagram" defaultValue={s.instagram} className="dash-input" dir="ltr" maxLength={120} placeholder="mystore" autoCapitalize="none" />
          </Field>
          <Field label="تيك توك">
            <input name="tiktok" defaultValue={s.tiktok} className="dash-input" dir="ltr" maxLength={120} placeholder="mystore" autoCapitalize="none" />
          </Field>
          <Field label="سناب شات">
            <input name="snapchat" defaultValue={s.snapchat} className="dash-input" dir="ltr" maxLength={120} placeholder="mystore" autoCapitalize="none" />
          </Field>
          <Field label="إكس (تويتر)">
            <input name="x" defaultValue={s.x} className="dash-input" dir="ltr" maxLength={120} placeholder="mystore" autoCapitalize="none" />
          </Field>
        </Section>

        <Section title="البيانات النظامية" hint="تظهر في متجرك وعلى الفاتورة. الرقم الضريبي يحوّل فواتيرك إلى فواتير ضريبية مبسطة." action={saveLegal}>
          <Field label="رقم السجل التجاري" hint="10 أرقام.">
            <input name="crNumber" defaultValue={s.crNumber} className="dash-input num" dir="ltr" inputMode="numeric" maxLength={12} />
          </Field>
          <Field label="الرقم الضريبي" hint="15 رقمًا يبدأ بـ 3. اتركه فاضي إذا منشأتك غير مسجّلة في الضريبة.">
            <input name="vatNumber" defaultValue={s.vatNumber} className="dash-input num" dir="ltr" inputMode="numeric" maxLength={17} />
          </Field>
        </Section>

        <Section title="الشحن" hint="رسوم شحن موحّدة لكل الطلبات، مع إمكانية الشحن المجاني فوق مبلغ معيّن." action={saveShipping}>
          <Field label="رسوم الشحن (ر.س)" hint="اكتب 0 إذا الشحن مجاني دايم.">
            <input name="shippingFee" defaultValue={sarInput(s.shippingFee)} className="dash-input num" dir="ltr" inputMode="decimal" maxLength={8} required />
          </Field>
          <Field label="شحن مجاني للطلبات فوق (ر.س)" hint="اكتب 0 لإيقاف الشحن المجاني.">
            <input name="freeShippingOver" defaultValue={sarInput(s.freeShippingOver)} className="dash-input num" dir="ltr" inputMode="decimal" maxLength={8} />
          </Field>
          <Field label="مدة التوصيل بالأيام" hint="مثل 3 أو 2-5. تظهر للعميل: «يوصلك خلال 2-5 أيام عمل».">
            <input name="shippingDays" defaultValue={s.shippingDays} className="dash-input num" dir="ltr" maxLength={7} required placeholder="2-5" />
          </Field>
        </Section>

        <Section title="بكسلات التتبع" hint="الصق معرّف البكسل فقط (مو الكود كامل) عشان تقيس حملاتك الإعلانية." action={savePixels}>
          <Field label="Meta Pixel ID" hint="فيسبوك وانستقرام — أرقام فقط.">
            <input name="metaPixelId" defaultValue={s.metaPixelId} className="dash-input num" dir="ltr" inputMode="numeric" maxLength={20} autoComplete="off" />
          </Field>
          <Field label="TikTok Pixel ID">
            <input name="tiktokPixelId" defaultValue={s.tiktokPixelId} className="dash-input num" dir="ltr" maxLength={40} autoComplete="off" autoCapitalize="none" />
          </Field>
          <Field label="Snap Pixel ID">
            <input name="snapPixelId" defaultValue={s.snapPixelId} className="dash-input num" dir="ltr" maxLength={40} autoComplete="off" autoCapitalize="none" />
          </Field>
        </Section>

        <Section title="السياسات" hint="تظهر في صفحتي «الشحن والتوصيل» و«الاستبدال والاسترجاع» في متجرك." action={savePolicies}>
          <Field label="سياسة الشحن والتوصيل" className="sm:col-span-2">
            <textarea name="shippingPolicy" defaultValue={store.content.shippingPolicy ?? ""} className="dash-input !min-h-36 leading-relaxed" maxLength={3000} />
          </Field>
          <Field label="سياسة الاستبدال والاسترجاع" className="sm:col-span-2">
            <textarea name="returnsPolicy" defaultValue={store.content.returnsPolicy ?? ""} className="dash-input !min-h-36 leading-relaxed" maxLength={3000} />
          </Field>
        </Section>

        <Section title="الحساب وكلمة المرور" hint={`مسجّل باسم ${merchant.name} — جوال الدخول ${merchant.phone}.`} action={changePassword} submit="غيّر كلمة المرور">
          <Field label="كلمة المرور الحالية">
            <input name="current" type="password" className="dash-input" dir="ltr" required autoComplete="current-password" maxLength={200} />
          </Field>
          <Field label="كلمة المرور الجديدة" hint="8 أحرف على الأقل.">
            <input name="next" type="password" className="dash-input" dir="ltr" required minLength={8} maxLength={200} autoComplete="new-password" />
          </Field>
        </Section>
      </div>
    </>
  );
}
