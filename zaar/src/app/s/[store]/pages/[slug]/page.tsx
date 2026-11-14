import { notFound } from "next/navigation";
import { PolicyView } from "@/components/store/PolicyView";
import { getPlatform } from "@/lib/platform";
import { getStoreBySlug } from "@/lib/stores";

const TITLES: Record<string, string> = { shipping: "الشحن والتوصيل", returns: "الاستبدال والاسترجاع", guarantee: "ضمان زار", privacy: "سياسة الخصوصية" };

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: TITLES[slug] ?? "صفحة" };
}

export default async function PolicyPage({ params }: { params: Promise<{ store: string; slug: string }> }) {
  const { store: storeSlug, slug } = await params;
  const store = await getStoreBySlug(storeSlug);
  if (!store || !TITLES[slug]) notFound();
  const cfg = await getPlatform();
  const paragraphs: Record<string, string[]> = {
    shipping: [store.content.shippingPolicy, `مدة التوصيل المتوقعة: ${store.settings.shippingDays} أيام عمل.`, store.settings.freeShippingOver > 0 ? `الشحن مجاني للطلبات التي تتجاوز ${store.settings.freeShippingOver / 100} ر.س، وما دونها برسوم ${store.settings.shippingFee / 100} ر.س.` : `رسوم الشحن ${store.settings.shippingFee / 100} ر.س لكل طلب.`],
    returns: [store.content.returnsPolicy, `كل الطلبات مشمولة بضمان زار: يحق لك طلب استرداد كامل المبلغ حتى ${cfg.guaranteeDays} يومًا بعد استلام الطلب.`],
    guarantee: [
      `كل طلب تدفعه في ${store.name} يمر عبر منصة زار، وزار تضمنه لك. إذا لم يصلك الطلب، أو وصل مختلفًا عن الوصف، أو تالفًا، تسترد مبلغك كاملًا.`,
      `متى: من لحظة الدفع وحتى ${cfg.guaranteeDays} يومًا بعد استلام الطلب.`,
      `كيف: افتح صفحة «تتبّع طلبك»، اكتب رقم الطلب وجوالك، ثم اضغط «اطلب استرداد المبلغ» واختر السبب.`,
      `ماذا يحدث بعدها: المتجر يرد خلال ${cfg.claimReplyHours} ساعة. إن وافق أو لم يرد يُعتمد استردادك تلقائيًا. وإن اعترض، يراجع فريق زار الحالة ويحسمها.`,
      "أين يرجع المبلغ: لوسيلة الدفع نفسها (البطاقة، تابي، أو تمارا) خلال 3 إلى 10 أيام عمل بحسب البنك.",
    ],
    privacy: [
      `نجمع فقط ما نحتاجه لتنفيذ طلبك: الاسم، رقم الجوال، العنوان، والبريد إن أدخلته. لا نخزّن بيانات بطاقتك؛ الدفع يتم لدى بوابات دفع مرخّصة.`,
      "نشارك بياناتك مع شركة الشحن لتوصيل طلبك، ومع منصة زار التي تشغّل المتجر وتضمن الطلب. لا نبيع بياناتك لأي طرف.",
      "لطلب حذف بياناتك أو تصحيحها تواصل مع المتجر عبر وسائل التواصل الموضحة أسفل الصفحة.",
    ],
  };
  return <PolicyView title={TITLES[slug]} paragraphs={paragraphs[slug].filter(Boolean)} />;
}
