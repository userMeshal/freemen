export type Category = { id: string; name: string; hue: number };

export const CATEGORIES: Category[] = [
  { id: 'electronics', name: 'جوالات وإلكترونيات', hue: 222 },
  { id: 'gaming', name: 'ألعاب وقيمنق', hue: 268 },
  { id: 'cars', name: 'سيارات وقطع', hue: 12 },
  { id: 'furniture', name: 'أثاث ومنزل', hue: 34 },
  { id: 'fashion', name: 'ساعات وأزياء', hue: 330 },
  { id: 'cameras', name: 'كاميرات وتصوير', hue: 190 },
  { id: 'computers', name: 'كمبيوترات', hue: 205 },
  { id: 'sports', name: 'رياضة ودراجات', hue: 150 },
  { id: 'books', name: 'كتب', hue: 48 },
  { id: 'kids', name: 'مستلزمات أطفال', hue: 350 },
  { id: 'collectibles', name: 'مقتنيات ونوادر', hue: 285 },
  { id: 'services', name: 'خدمات ومهارات', hue: 170 },
];

export const CITIES = [
  'الرياض', 'جدة', 'مكة المكرمة', 'المدينة المنورة', 'الدمام', 'الخبر', 'الأحساء',
  'الطائف', 'أبها', 'تبوك', 'بريدة', 'حائل', 'جازان', 'نجران', 'ينبع', 'الجبيل',
];

export const CONDITIONS = ['جديد', 'شبه جديد', 'مستعمل نظيف', 'مستعمل'];

/** شرائح قيمة تقريبية — للمقارنة العادلة فقط، ما فيه دفع */
export const VALUE_TIERS = [
  'أقل من 500',
  '500 – 1,500',
  '1,500 – 5,000',
  '5,000 – 15,000',
  'أكثر من 15,000',
];

export type Kind = 'swap' | 'sale' | 'auction';

export const KINDS: { id: Kind; name: string; verb: string }[] = [
  { id: 'swap', name: 'بدل', verb: 'بدّل' },
  { id: 'sale', name: 'بيع', verb: 'بِع' },
  { id: 'auction', name: 'مزاد', verb: 'زاوِد' },
];

export type Listing = {
  id: string;
  /** بدل / بيع بسعر ثابت / مزاد */
  kind: Kind;
  /** سعر البيع، أو سعر بداية المزاد */
  price?: number;
  minIncrement?: number;
  /** بداية المزاد: تتحدد بعد تأكيد دفع رسم العرض */
  startsAt?: number;
  durationMinutes?: number;
  /** نهاية المزاد */
  endsAt?: number;
  currentBid?: number;
  topBidder?: string;
  bidsCount?: number;
  title: string;
  category: string;
  condition: string;
  city: string;
  description: string;
  wants: string[];
  openToOffers: boolean;
  valueTier: number;
  /** القيمة التقريبية بالريال (العروض القديمة فيها الشريحة فقط) */
  estValue?: number;
  images: string[];
  ownerId: string;
  ownerName: string;
  whatsapp?: string;
  createdAt: number;
  seedOffers?: number;
  /** نسخة تعهد سداد رسوم الموقع اللي وافق عليها المعلن عند النشر */
  pledgeVersion?: string;
  /** عدد عروض البدل من قاعدة البيانات */
  offersCount?: number;
};

export type Bid = { id: string; listingId: string; bidderId: string; bidderName: string; amount: number; createdAt: number };

/** طلب دخول مزاد: المستخدم يحوّل الرسم بنكياً والمشرف يتحقق ويفعّل */
export type Entry = {
  id: string;
  listingId: string;
  userId: string;
  userName?: string;
  listingTitle?: string;
  senderName: string;
  reference: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
  demo?: boolean;
};

/** رسم عرض المزاد: يدفعه صاحب المزاد ليتفعّل مزاده */
export type Fee = {
  listingId: string;
  ownerId: string;
  ownerName?: string;
  listingTitle?: string;
  senderName: string;
  reference: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
  demo?: boolean;
};

export type Offer = {
  id: string;
  /** عرض بدل (غرض ± مبلغ) أو عرض شراء (مبلغ فقط) */
  kind?: 'swap' | 'buy';
  listingId: string;
  fromId: string;
  fromName: string;
  itemTitle: string;
  itemCategory: string;
  itemCondition: string;
  valueTier: number;
  /** قيمة الغرض المعروض بالريال */
  estValue?: number;
  /** مبلغ نقدي يضيفه صاحب العرض فوق غرضه */
  cash?: number;
  note: string;
  image?: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: number;
  demo?: boolean;
};

const H = 3600_000;
const T0 = Date.now();
const s = (
  n: number, title: string, category: string, condition: string, city: string, valueTier: number,
  wants: string[], ownerName: string, hoursAgo: number, seedOffers: number, description: string,
  openToOffers = true,
): Listing => ({
  id: `s${n}`, kind: 'swap', title, category, condition, city, valueTier, wants, ownerName, description, openToOffers,
  images: [], ownerId: `seed-${n}`, createdAt: T0 - hoursAgo * H, seedOffers,
});

export const SEED: Listing[] = [
  s(1, 'آيفون 14 برو 256 قيقا', 'electronics', 'شبه جديد', 'الرياض', 2, ['بلايستيشن 5', 'ماك بوك اير'], 'فهد', 2, 7,
    'الجهاز نظيف وبطاريته 91٪، معه الكرتون والشاحن الأصلي. استخدام شخصي بدون أي خدوش.'),
  s(2, 'بلايستيشن 5 مع يدين', 'gaming', 'مستعمل نظيف', 'جدة', 2, ['آيفون', 'آيباد برو'], 'سلطان', 5, 12,
    'نسخة الديسك، مع يدين وثلاث ألعاب. شغال تمام وما فتح أبداً.'),
  s(3, 'كنب زاوية مودرن رمادي', 'furniture', 'مستعمل نظيف', 'الدمام', 2, ['طاولة طعام', 'مكتب خشب'], 'أم عبدالله', 9, 3,
    'كنب زاوية ٧ مقاعد، قماش ضد البقع. غيّرنا الديكور ونبي نبدله بشي ينفعنا.'),
  s(4, 'كاميرا سوني A7 III مع عدسة', 'cameras', 'شبه جديد', 'الرياض', 3, ['ماك بوك برو', 'درون DJI'], 'ريان', 14, 5,
    'عدد اللقطات قليل، معها عدسة 28-70 وبطاريتين وشنطة.'),
  s(5, 'دراجة هوائية جبلية ترِك', 'sports', 'مستعمل نظيف', 'أبها', 2, ['معدات تخييم', 'ساعة ذكية'], 'ماجد', 20, 4,
    'مقاس M، سرعات شيمانو، مناسبة لطرق الجبال. صيانتها أول بأول.'),
  s(6, 'ماك بوك اير M2', 'computers', 'شبه جديد', 'الخبر', 3, ['كمبيوتر قيمنق', 'آيفون 15 برو'], 'نواف', 26, 9,
    'رام 16 وتخزين 512، عدد دورات البطارية 43 فقط.'),
  s(7, 'ساعة أوميغا سيماستر', 'fashion', 'مستعمل نظيف', 'جدة', 4, ['ساعة تودور', 'ساعة رولكس مع فرق بدل'], 'تركي', 30, 6,
    'مع العلبة والضمان. أبي أجرب موديل ثاني، البدل بساعة بنفس المستوى.', false),
  s(8, 'جنوط 20 مع كفرات — لاندكروزر', 'cars', 'مستعمل نظيف', 'بريدة', 2, ['شاشة سيارة', 'حامل سقف'], 'عبدالعزيز', 38, 2,
    'جنوط وكالة نظيفة، الكفرات ماشية 10 آلاف بس.'),
  s(9, 'مجموعة روايات عربية (40 كتاب)', 'books', 'مستعمل نظيف', 'المدينة المنورة', 0, ['كتب تطوير ذات', 'كيندل'], 'لمى', 44, 5,
    'قرأتها كلها وحابة غيري يستفيد. أبدلها بكتب ما قرأتها.'),
  s(10, 'عربية أطفال دونا', 'kids', 'شبه جديد', 'الرياض', 1, ['سرير أطفال', 'كرسي سيارة أكبر'], 'أم ريم', 50, 3,
    'استخدام ٤ شهور، نظيفة جداً ومعها القاعدة.'),
  s(11, 'تصميم هوية بصرية كاملة', 'services', 'جديد', 'الرياض', 2, ['تصوير منتجات', 'برمجة متجر'], 'جود', 55, 8,
    'مصممة هويات، أبدل خدمتي بخدمة: شعار + ألوان + دليل استخدام مقابل تصوير أو برمجة.'),
  s(12, 'نينتندو سويتش OLED', 'gaming', 'شبه جديد', 'الطائف', 1, ['سماعة ايربودز برو', 'ألعاب PS5'], 'يزيد', 60, 4,
    'معه لعبتين وحافظة. استخدام خفيف.'),
  s(13, 'عملات سعودية قديمة ونادرة', 'collectibles', 'مستعمل نظيف', 'مكة المكرمة', 2, ['طوابع قديمة', 'ساعات جيب'], 'أبو خالد', 70, 6,
    'مجموعة من عهد الملك عبدالعزيز والملك سعود، محفوظة في ألبوم.'),
  s(14, 'كمبيوتر قيمنق RTX 4070', 'computers', 'مستعمل نظيف', 'الدمام', 3, ['ماك بوك برو', 'بلايستيشن 5 + شاشة'], 'بدر', 80, 11,
    'رايزن 7، رام 32، تبريد مائي. يشغّل كل شي على ألترا.'),
  s(15, 'خيمة تخييم ٦ أشخاص مع عدّتها', 'sports', 'مستعمل نظيف', 'حائل', 1, ['شواية غاز', 'ثلاجة رحلات'], 'سعود', 92, 2,
    'خيمة شتوية مع فرشة وكشاف. طلعات البر عليكم.'),
  s(16, 'آيباد برو 11 مع القلم', 'electronics', 'شبه جديد', 'تبوك', 2, ['لابتوب', 'كاميرا'], 'رغد', 100, 5,
    'M2، مع القلم والكيبورد. للدراسة والرسم.'),
];

/** عروض بيع ومزادات نموذجية للوضع التجريبي */
const extra = (base: Listing, patch: Partial<Listing>): Listing => ({ ...base, wants: [], openToOffers: false, ...patch });
SEED.splice(
  2, 0,
  extra(s(17, 'ثلاجة سامسونج 18 قدم', 'furniture', 'مستعمل نظيف', 'الرياض', 2, [], 'أبو فيصل', 3, 4, 'ثلاجة بابين، شغّالة تمام، السبب الانتقال لبيت جديد.'), { kind: 'sale', price: 1400 }),
  extra(s(18, 'رولكس ديت جست 36', 'fashion', 'مستعمل نظيف', 'جدة', 4, [], 'هاني', 6, 0, 'موديل 2019 مع العلبة والضمان. المزاد يبدأ من سعر رمزي.'), {
    kind: 'auction', price: 15000, minIncrement: 500, startsAt: T0 - 2 * H, endsAt: T0 + 26 * H, currentBid: 21500, bidsCount: 9, topBidder: 'seed-bidder-1',
  }),
  extra(s(19, 'بلايستيشن 5 برو', 'gaming', 'جديد', 'الدمام', 2, [], 'مهند', 8, 0, 'جديد بالكرتون ما انفتح.'), {
    kind: 'auction', price: 1000, minIncrement: 50, startsAt: T0 - H, endsAt: T0 + 5 * H, currentBid: 1850, bidsCount: 14, topBidder: 'seed-bidder-2',
  }),
  extra(s(20, 'آيباد اير M2 مع القلم', 'electronics', 'شبه جديد', 'مكة المكرمة', 2, [], 'ريما', 11, 2, 'استخدام ثلاث شهور، مع القلم والحافظة.'), { kind: 'sale', price: 2100 }),
  extra(s(21, 'لوحة خط عربي أصلية', 'collectibles', 'جديد', 'المدينة المنورة', 2, [], 'الخطاط سالم', 15, 0, 'لوحة بخط الثلث، حبر على ورق مقهّر، مقاس 70×50.'), {
    kind: 'auction', price: 500, minIncrement: 50, startsAt: T0 + 22 * 60_000, durationMinutes: 60, endsAt: T0 + 82 * 60_000, bidsCount: 0,
  }),
);

/** الوقت المتبقي للمزاد بصيغة قصيرة */
export function timeLeft(endsAt: number, now = Date.now()) {
  const ms = endsAt - now;
  if (ms <= 0) return 'انتهى';
  const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d} يوم ${h} س`;
  if (h > 0) return `${h} س ${m} د`;
  if (m > 0) return `${m} د ${s % 60} ث`;
  return `${s} ث`;
}

export const auctionEnded = (l: Pick<Listing, 'endsAt'>, now = Date.now()) => !!l.endsAt && l.endsAt <= now;

export type Phase = 'unpaid' | 'upcoming' | 'live' | 'ended';

/** مرحلة المزاد: بانتظار دفع رسم العرض ← قبل البداية (التسجيل) ← شغّال ← انتهى */
export function auctionPhase(l: Pick<Listing, 'startsAt' | 'endsAt'>, now = Date.now()): Phase {
  if (!l.endsAt) return 'unpaid';
  if (l.endsAt <= now) return 'ended';
  return l.startsAt && now < l.startsAt ? 'upcoming' : 'live';
}

/** التسجيل يقفل قبل بداية المزاد بدقائق (cutoff) */
export const registrationCloses = (l: Pick<Listing, 'startsAt'>, cutoffMinutes: number) => (l.startsAt ?? 0) - cutoffMinutes * 60_000;

/** سطر قصير يوصف حالة المزاد في البطاقات والقوائم */
export function auctionStatus(l: Pick<Listing, 'startsAt' | 'endsAt'>, now = Date.now()) {
  const phase = auctionPhase(l, now);
  if (phase === 'unpaid') return 'بانتظار التفعيل';
  if (phase === 'upcoming') return `يبدأ بعد ${timeLeft(l.startsAt!, now)}`;
  if (phase === 'live') return `باقي ${timeLeft(l.endsAt!, now)}`;
  return 'انتهى المزاد';
}

/** أقل مزايدة مقبولة الآن */
export const minNextBid = (l: Pick<Listing, 'price' | 'currentBid' | 'minIncrement'>) =>
  l.currentBid == null ? l.price ?? 1 : l.currentBid + (l.minIncrement ?? 10);

export const catById = (id: string) => CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0];

export function timeAgo(ts: number) {
  const diff = Math.max(0, Date.now() - ts);
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'الآن';
  if (m < 60) return `قبل ${m} د`;
  const h = Math.floor(m / 60);
  if (h < 24) return `قبل ${h} س`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'أمس' : `قبل ${d} يوم`;
}

const TIER_MID = [250, 1000, 3000, 10000, 20000];
const TIER_MAX = [500, 1500, 5000, 15000];

/** الشريحة المقابلة لقيمة بالريال */
export const tierOf = (value: number) => {
  const i = TIER_MAX.findIndex((max) => value < max);
  return i === -1 ? 4 : i;
};

export const listingValue = (l: Pick<Listing, 'estValue' | 'valueTier' | 'price'>) => l.estValue ?? l.price ?? TIER_MID[l.valueTier] ?? TIER_MID[1];

/** قيمة عرض البدل كاملة = قيمة الغرض + المبلغ المضاف */
export const offerValue = (o: Pick<Offer, 'estValue' | 'valueTier' | 'cash'>) =>
  (o.estValue ?? TIER_MID[o.valueTier] ?? TIER_MID[1]) + (o.cash ?? 0);

export const formatSAR = (n: number) => `${Math.round(n).toLocaleString('en-US')} ريال`;

/** يقرأ رقم من حقل نصي — يقبل الأرقام العربية والفواصل */
export function parseAmount(text: string) {
  const digits = text.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[^\d]/g, '');
  return digits ? Math.min(Number(digits), 10_000_000) : 0;
}

/** يقارن قيمة الغرض المعروض (target) بقيمة عرض البدل (offered) */
export function fairness(target: number, offered: number) {
  const r = target > 0 ? offered / target : 1;
  if (r >= 0.75 && r <= 1.34) return { label: 'قيمة متقاربة', level: 2 };
  if (r >= 0.5 && r <= 2) return { label: 'فرق بسيط', level: 1 };
  return { label: 'فرق كبير بالقيمة', level: 0 };
}
