import { z } from "zod";
import { ICONS, PALETTE_IDS, VERTICALS, resolvePalette } from "./themes";
import type { StoreContent } from "./types";

/**
 * «المخطط»: وصف كامل لمتجر يولّده الذكاء الاصطناعي من فكرة التاجر.
 * نفس المخطط يُستخدم للمولّد المحلي الاحتياطي ولـ Claude (structured outputs).
 */
export const BlueprintSchema = z.object({
  reply: z.string().describe("رد قصير ودّي للتاجر بلهجة سعودية بيضاء يشرح ما تم بناؤه (جملتان كحد أقصى)"),
  name: z.string().describe("اسم المتجر بالعربية، قصير ومميز"),
  nameLatin: z.string().describe("كلمة لاتينية واحدة قصيرة (3-7 أحرف) تمثل العلامة، بأحرف كبيرة"),
  slug: z.string().describe("معرّف الرابط: أحرف لاتينية صغيرة وأرقام وشرطات فقط"),
  tagline: z.string().describe("شعار نصي من جملة قصيرة"),
  description: z.string().describe("وصف المتجر في جملتين لمحركات البحث"),
  vertical: z.enum(VERTICALS),
  theme: z.enum(["bold", "soft"]).describe("bold: جريء سينمائي للعلامات الشبابية والجريئة. soft: ناعم زجاجي للعلامات الراقية والهادئة"),
  palette: z.enum(PALETTE_IDS as [string, ...string[]]),
  headline: z.array(z.string()).describe("ثلاث كلمات أو عبارات قصيرة جدًا للعنوان الافتتاحي، كل واحدة تنتهي بنقطة"),
  heroText: z.string().describe("جملة تعريفية تحت العنوان"),
  manifesto: z.string().describe("فقرة من 25-40 كلمة تحكي قصة العلامة ولماذا تختلف"),
  accentWords: z.array(z.string()).describe("2-3 كلمات من نص manifesto تُبرز بخط مميز، مطابقة حرفيًا"),
  stats: z.array(z.object({ value: z.number(), unit: z.string(), label: z.string() })).describe("3-4 أرقام واقعية عن المنتج أو الخدمة (ليست أرقام مبيعات)"),
  features: z.array(z.object({ icon: z.enum(ICONS), title: z.string(), text: z.string() })).describe("3-4 مزايا للمتجر"),
  marquee: z.array(z.string()).describe("5-7 كلمات أو عبارات قصيرة للشريط المتحرك"),
  announcement: z.string().describe("نص شريط الإعلان العلوي، قصير"),
  ctaTitle: z.string(),
  ctaText: z.string(),
  categories: z.array(z.object({ name: z.string(), icon: z.enum(ICONS) })).describe("2-5 تصنيفات"),
  products: z
    .array(
      z.object({
        name: z.string(),
        category: z.string().describe("اسم أحد التصنيفات أعلاه حرفيًا"),
        description: z.string().describe("وصف تسويقي من 2-3 جمل"),
        price: z.number().describe("السعر بالريال السعودي شامل الضريبة"),
        compareAtPrice: z.number().nullable().describe("السعر قبل الخصم أو null"),
        icon: z.enum(ICONS),
        hue: z.number().describe("درجة اللون 0-360 للوحة المنتج"),
        optionName: z.string().nullable().describe("اسم الخيار مثل المقاس أو الحجم أو اللون، أو null"),
        optionValues: z.array(z.string()).describe("قيم الخيار، أو مصفوفة فارغة"),
        featured: z.boolean(),
      }),
    )
    .describe("8-12 منتجًا واقعيًا بأسعار منطقية للسوق السعودي"),
});

export type Blueprint = z.infer<typeof BlueprintSchema>;

const clip = (s: unknown, n: number) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const asIcon = (s: unknown) => ((ICONS as readonly string[]).includes(String(s)) ? String(s) : "Sparkles");

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

/** يضبط حدود كل الحقول ويُسقط ما لا يصلح — مخرجات أي نموذج تمر من هنا قبل الحفظ */
export function normalizeBlueprint(raw: Blueprint): Blueprint {
  const categories = (raw.categories ?? [])
    .map((c) => ({ name: clip(c.name, 40), icon: asIcon(c.icon) as Blueprint["categories"][number]["icon"] }))
    .filter((c) => c.name)
    .slice(0, 6);
  if (!categories.length) categories.push({ name: "المنتجات", icon: "Sparkles" });
  const catNames = new Set(categories.map((c) => c.name));

  const products = (raw.products ?? [])
    .map((p) => {
      const price = Math.max(1, Math.min(100000, Number(p.price) || 0));
      const compare = p.compareAtPrice && Number(p.compareAtPrice) > price ? Math.min(200000, Number(p.compareAtPrice)) : null;
      const values = (p.optionValues ?? []).map((v) => clip(v, 30)).filter(Boolean).slice(0, 8);
      return {
        name: clip(p.name, 90),
        category: catNames.has(clip(p.category, 40)) ? clip(p.category, 40) : categories[0].name,
        description: clip(p.description, 600),
        price: Math.round(price * 100) / 100,
        compareAtPrice: compare,
        icon: asIcon(p.icon) as Blueprint["products"][number]["icon"],
        hue: ((Math.round(Number(p.hue) || 0) % 360) + 360) % 360,
        optionName: values.length > 1 && p.optionName ? clip(p.optionName, 24) : null,
        optionValues: values.length > 1 && p.optionName ? values : [],
        featured: Boolean(p.featured),
      };
    })
    .filter((p) => p.name)
    .slice(0, 16);

  const theme = raw.theme === "soft" ? "soft" : "bold";
  const latin = clip(raw.nameLatin, 12).replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return {
    reply: clip(raw.reply, 400),
    name: clip(raw.name, 40) || "متجري",
    nameLatin: latin,
    slug: slugify(raw.slug || latin) || "store",
    tagline: clip(raw.tagline, 90),
    description: clip(raw.description, 300),
    vertical: (VERTICALS as readonly string[]).includes(raw.vertical) ? raw.vertical : "general",
    theme,
    palette: resolvePalette(raw.palette, theme).preset,
    headline: (raw.headline ?? []).map((h) => clip(h, 18)).filter(Boolean).slice(0, 3),
    heroText: clip(raw.heroText, 180),
    manifesto: clip(raw.manifesto, 420),
    accentWords: (raw.accentWords ?? []).map((w) => clip(w, 24)).filter(Boolean).slice(0, 4),
    stats: (raw.stats ?? [])
      .map((s) => ({ value: Math.max(0, Math.min(9999, Math.round(Number(s.value) || 0))), unit: clip(s.unit, 14), label: clip(s.label, 28) }))
      .filter((s) => s.label)
      .slice(0, 4),
    features: (raw.features ?? [])
      .map((f) => ({ icon: asIcon(f.icon) as Blueprint["features"][number]["icon"], title: clip(f.title, 40), text: clip(f.text, 160) }))
      .filter((f) => f.title)
      .slice(0, 4),
    marquee: (raw.marquee ?? []).map((m) => clip(m, 28)).filter(Boolean).slice(0, 8),
    announcement: clip(raw.announcement, 90),
    ctaTitle: clip(raw.ctaTitle, 60),
    ctaText: clip(raw.ctaText, 140),
    categories,
    products,
  };
}

export function blueprintContent(b: Blueprint): StoreContent {
  return {
    headline: b.headline.length ? b.headline : [b.name],
    heroText: b.heroText,
    manifesto: b.manifesto,
    accentWords: b.accentWords,
    stats: b.stats,
    features: b.features,
    marquee: b.marquee.length ? b.marquee : [b.name, b.tagline].filter(Boolean),
    announcement: b.announcement,
    ctaTitle: b.ctaTitle,
    ctaText: b.ctaText,
    shippingPolicy:
      "نشحن طلبك خلال يوم إلى ثلاثة أيام عمل من تأكيد الدفع، ويصلك رقم التتبع فور خروج الشحنة. مدة التوصيل داخل المدن الرئيسية من يومين إلى خمسة أيام عمل.",
    returnsPolicy:
      "يحق لك طلب الاستبدال أو الاسترجاع خلال المدة المحددة في ضمان زار إذا وصلك المنتج مختلفًا عن الوصف أو به عيب أو لم يصلك. قدّم الطلب من صفحة تتبع طلبك، وسنرد عليك خلال يومي عمل.",
  };
}
