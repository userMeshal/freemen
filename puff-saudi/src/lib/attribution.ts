/**
 * مصدر الطلب: من أي منصة جاء العميل (تيك توك، ميتا، سناب…)، ليُكتب على الطلب ويظهر في لوحة التحكم.
 *
 * يُلتقط المصدر عند دخول الزائر للموقع (components/site/Attribution.tsx)، يُحفظ في متصفحه، ثم يُرسَل مع الطلب.
 * هذا الملف مشترك بين المتصفح والخادم: كشف المصدر، وتنظيف ما يصل من المتصفح قبل حفظه.
 *
 * ترتيب الأدلة من الأقوى للأضعف:
 *   1) معرّف النقرة الذي تضيفه المنصة للرابط (ttclid، ScCid، gclid…)
 *   2) وسوم UTM التي يضعها المعلن في رابط الإعلان
 *   3) متصفح التطبيق نفسه (الزائر فتح الرابط من داخل تيك توك / إنستغرام / سناب)
 *   4) الموقع المُحيل (referrer)
 *   5) لا شيء ← «مباشر»
 */

export const SOURCE_KEYS = ["tiktok", "meta", "snapchat", "google", "x", "pinterest", "other", "direct"] as const;
export type SourceKey = (typeof SOURCE_KEYS)[number];

export const SOURCE_LABEL: Record<SourceKey, string> = {
  tiktok: "تيك توك",
  meta: "ميتا (فيسبوك / إنستغرام)",
  snapchat: "سناب شات",
  google: "قوقل",
  x: "إكس (تويتر)",
  pinterest: "بنترست",
  other: "مصدر آخر",
  direct: "مباشر",
};

export const SOURCE_SHORT: Record<SourceKey, string> = {
  tiktok: "تيك توك",
  meta: "ميتا",
  snapchat: "سناب",
  google: "قوقل",
  x: "إكس",
  pinterest: "بنترست",
  other: "آخر",
  direct: "مباشر",
};

export type Attribution = {
  platform: SourceKey;
  /** true فقط عندما يدل الرابط على نقرة إعلان مدفوع. false = غير معروف أو غير مدفوع */
  paid: boolean;
  /** كيف عُرف المصدر */
  via: "click_id" | "utm" | "app" | "referrer" | "none";
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
  /** نطاق الموقع المُحيل فقط، بلا مسار */
  referrer?: string;
  /** أول صفحة فتحها الزائر (المسار فقط) */
  landing?: string;
  /** وقت الزيارة التي حُدد منها المصدر */
  at?: string;
};

/**
 * معرّفات النقرات. fbclid تضيفه ميتا لكل الروابط الخارجة منها (إعلانًا كان أو منشورًا عاديًا) فلا يدل وحده
 * على إعلان مدفوع؛ بقية المعرّفات تُضاف لنقرات الإعلانات.
 */
const CLICK_IDS: [param: string, platform: SourceKey, paid: boolean][] = [
  ["ttclid", "tiktok", true],
  ["sccid", "snapchat", true],
  ["gclid", "google", true],
  ["gbraid", "google", true],
  ["wbraid", "google", true],
  ["twclid", "x", true],
  ["epik", "pinterest", true],
  ["fbclid", "meta", false],
];

const NAMES: [pattern: RegExp, platform: SourceKey][] = [
  [/^(tiktok|tik[-_ ]?tok|tt)$/, "tiktok"],
  [/^(facebook|fb|instagram|ig|meta|messenger|threads)$/, "meta"],
  [/^(snapchat|snap|sc)$/, "snapchat"],
  [/^(google|adwords|googleads|youtube|gads)$/, "google"],
  [/^(twitter|x|t\.co)$/, "x"],
  [/^(pinterest|pin)$/, "pinterest"],
];

const HOSTS: [pattern: RegExp, platform: SourceKey][] = [
  [/(^|\.)tiktok\.com$/, "tiktok"],
  [/(^|\.)(facebook\.com|instagram\.com|fb\.com|fb\.me|messenger\.com|threads\.net)$/, "meta"],
  [/(^|\.)snapchat\.com$/, "snapchat"],
  [/(^|\.)(google\.[a-z.]{2,6}|youtube\.com|googleadservices\.com|doubleclick\.net)$/, "google"],
  [/(^|\.)(twitter\.com|x\.com)$|^t\.co$/, "x"],
  [/(^|\.)(pinterest\.[a-z.]{2,6}|pin\.it)$/, "pinterest"],
];

/** متصفحات التطبيقات تعرّف نفسها في User-Agent */
const APPS: [pattern: RegExp, platform: SourceKey][] = [
  [/musical_ly|BytedanceWebview|TikTok/i, "tiktok"],
  [/Instagram|FBAN|FBAV|FB_IAB|Barcelona/, "meta"],
  [/Snapchat/i, "snapchat"],
  [/Twitter/i, "x"],
  [/Pinterest/i, "pinterest"],
];

const PAID_MEDIUM = /(^|[^a-z])(cpc|ppc|cpm|cpa|paid|paidsocial|paid[-_ ]social|ads?|adv|sponsored)([^a-z]|$)/;

const clip = (v: string | null | undefined, max = 120) => (v ?? "").replace(/[<>\u0000-\u001f]/g, "").trim().slice(0, max);

export function detectAttribution(input: { url: string; referrer?: string; userAgent?: string; ownHost?: string }): Attribution {
  let url: URL;
  try {
    url = new URL(input.url, "https://local.invalid");
  } catch {
    return { platform: "direct", paid: false, via: "none" };
  }
  // أسماء المعاملات غير حساسة لحالة الأحرف (سناب يرسل ScCid)
  const params = new Map<string, string>();
  url.searchParams.forEach((value, key) => params.set(key.toLowerCase(), value));

  const utm = {
    source: clip(params.get("utm_source"), 60).toLowerCase(),
    medium: clip(params.get("utm_medium"), 60).toLowerCase(),
    campaign: clip(params.get("utm_campaign")),
    content: clip(params.get("utm_content")),
    term: clip(params.get("utm_term")),
  };
  const utmPaid = PAID_MEDIUM.test(utm.medium);
  const details: Partial<Attribution> = {};
  for (const key of ["source", "medium", "campaign", "content", "term"] as const) if (utm[key]) details[key] = utm[key];
  details.landing = clip(url.pathname, 200) || "/";

  let refHost = "";
  try {
    refHost = input.referrer ? new URL(input.referrer).hostname.toLowerCase().replace(/^www\./, "") : "";
  } catch {
    refHost = "";
  }
  const own = (input.ownHost ?? "").toLowerCase().replace(/^www\./, "");
  if (refHost && own && (refHost === own || refHost.endsWith("." + own))) refHost = "";
  if (refHost) details.referrer = clip(refHost, 100);

  const click = CLICK_IDS.find(([param]) => params.get(param));
  if (click) return { platform: click[1], paid: click[2] || utmPaid, via: "click_id", ...details };

  if (utm.source) {
    const named = NAMES.find(([pattern]) => pattern.test(utm.source));
    return { platform: named ? named[1] : "other", paid: utmPaid, via: "utm", ...details };
  }

  const app = APPS.find(([pattern]) => pattern.test(input.userAgent ?? ""));
  if (app) return { platform: app[1], paid: false, via: "app", ...details };

  if (refHost) {
    const host = HOSTS.find(([pattern]) => pattern.test(refHost));
    return { platform: host ? host[1] : "other", paid: false, via: "referrer", ...details };
  }

  return { platform: "direct", paid: false, via: "none", ...details };
}

/** ينظّف ما أرسله المتصفح قبل حفظه على الطلب: قيم معروفة فقط ونصوص قصيرة بلا رموز HTML */
export function cleanAttribution(input: unknown): Attribution | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const platform = SOURCE_KEYS.find((k) => k === raw.platform);
  if (!platform) return null;
  const via = (["click_id", "utm", "app", "referrer", "none"] as const).find((v) => v === raw.via) ?? "none";
  const out: Attribution = { platform, paid: raw.paid === true, via };
  for (const key of ["source", "medium", "campaign", "content", "term", "referrer"] as const) {
    const value = typeof raw[key] === "string" ? clip(raw[key] as string) : "";
    if (value) out[key] = value;
  }
  const landing = typeof raw.landing === "string" ? clip(raw.landing, 200) : "";
  if (landing.startsWith("/")) out.landing = landing;
  const at = typeof raw.at === "string" && !Number.isNaN(Date.parse(raw.at)) ? new Date(raw.at).toISOString() : "";
  if (at) out.at = at;
  return out;
}

/** وصف قصير للعرض: «تيك توك · إعلان» */
export function sourceText(a: Pick<Attribution, "platform" | "paid"> | null | undefined, short = false): string {
  if (!a) return "غير معروف";
  const name = (short ? SOURCE_SHORT : SOURCE_LABEL)[a.platform] ?? "غير معروف";
  return a.paid ? `${name} · إعلان` : name;
}

/* ───────── المتصفح: حفظ المصدر بين الزيارة والطلب ───────── */

const STORE_KEY = "puff-source";
const KEEP_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * يُستدعى مرة عند كل تحميل صفحة. آخر مصدر «غير مباشر» خلال 30 يومًا هو المعتمد: من جاء من إعلان تيك توك
 * ثم عاد بعد يومين بكتابة الرابط مباشرة يبقى طلبه محسوبًا لتيك توك.
 */
export function captureAttribution(): void {
  if (typeof window === "undefined") return;
  // العودة من صفحة البنك أو بوابة الدفع ليست «مصدرًا»: لا أحد يدخل المتجر أول مرة من هذه الصفحات
  if (/^\/(checkout|order)\//.test(window.location.pathname)) return;
  try {
    const now = detectAttribution({
      url: window.location.href,
      referrer: document.referrer,
      userAgent: navigator.userAgent,
      ownHost: window.location.hostname,
    });
    now.at = new Date().toISOString();
    const saved = readAttribution();
    if (now.platform !== "direct" || !saved) localStorage.setItem(STORE_KEY, JSON.stringify(now));
  } catch {
    // التخزين غير متاح (تصفح خاص مثلًا) — الطلب يُسجَّل بلا مصدر
  }
}

export function readAttribution(): Attribution | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = cleanAttribution(JSON.parse(localStorage.getItem(STORE_KEY) ?? "null"));
    if (!saved?.at || Date.now() - Date.parse(saved.at) > KEEP_MS) return null;
    return saved;
  } catch {
    return null;
  }
}
