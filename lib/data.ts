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

export type Listing = {
  id: string;
  title: string;
  category: string;
  condition: string;
  city: string;
  description: string;
  wants: string[];
  openToOffers: boolean;
  valueTier: number;
  images: string[];
  ownerId: string;
  ownerName: string;
  whatsapp?: string;
  createdAt: number;
  seedOffers?: number;
  /** عدد عروض البدل من قاعدة البيانات */
  offersCount?: number;
};

export type Offer = {
  id: string;
  listingId: string;
  fromId: string;
  fromName: string;
  itemTitle: string;
  itemCategory: string;
  itemCondition: string;
  valueTier: number;
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
  id: `s${n}`, title, category, condition, city, valueTier, wants, ownerName, description, openToOffers,
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

export function fairness(a: number, b: number) {
  const d = Math.abs(a - b);
  if (d === 0) return { label: 'قيمة متقاربة', level: 2 };
  if (d === 1) return { label: 'فرق بسيط', level: 1 };
  return { label: 'فرق كبير بالقيمة', level: 0 };
}
