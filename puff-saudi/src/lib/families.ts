/**
 * عائلات المنتجات (سيبي، كوفي، فليبي…) — المواصفات مأخوذة حرفيًا من أوصاف المنتجات في المتجر.
 */
export type FamilyKey = "sippy" | "coffee" | "flippy" | "special" | "accessories";

export type Family = {
  key: FamilyKey;
  /** القيم المخزنة في products.family التي تتبع هذه العائلة */
  members: string[];
  name: string;
  latin: string;
  line: string;
  blurb: string;
  specs: { value: string; unit: string; label: string }[];
};

export const FAMILIES: Family[] = [
  {
    key: "sippy",
    members: ["sippy"],
    name: "بف سيبي",
    latin: "SIPPY",
    line: "للبارد. دائمًا بارد.",
    blurb: "كوب بماصة وغطاء محكم للمشروبات الباردة. ستانلس ستيل 304 من الداخل والخارج بعزل من طبقتين.",
    specs: [
      { value: "7", unit: "ساعات", label: "برودة" },
      { value: "20", unit: "ساعة", label: "ثلج" },
      { value: "304", unit: "ستانلس", label: "داخل وخارج" },
    ],
  },
  {
    key: "coffee",
    members: ["coffee"],
    name: "بف كوفي",
    latin: "COFFEE",
    line: "قهوتك كما تحبها. لساعات.",
    blurb: "للمشروبات الساخنة والباردة بطبقة داخلية من السيراميك، جدار مزدوج بعزل مفرّغ من الهواء وغطاء مقاوم للتسرب.",
    specs: [
      { value: "12", unit: "ساعة", label: "حرارة" },
      { value: "0", unit: "BPA", label: "خالٍ من BPA والرصاص" },
      { value: "✓", unit: "", label: "مناسب لغسالة الصحون" },
    ],
  },
  {
    key: "flippy",
    members: ["flippy-steel", "flippy-tritan"],
    name: "بف فليبي",
    latin: "FLIPPY",
    line: "للصغار. بلا انسكاب.",
    blurb: "كوب الأطفال بغطاء محكم وماصة مدمجة — ستانلس ستيل مزدوج الجدار أو تريتان خفيف.",
    specs: [
      { value: "24", unit: "ساعة", label: "برودة (ستانلس)" },
      { value: "0", unit: "BPA", label: "خالٍ من BPA والرصاص" },
      { value: "2", unit: "خامات", label: "ستانلس وتريتان" },
    ],
  },
  {
    key: "special",
    members: ["special"],
    name: "إصدار خاص",
    latin: "SPECIAL EDITION",
    line: "قطع لا تتكرر.",
    blurb: "إصدارات خاصة من بف بتصاميم محدودة.",
    specs: [],
  },
  {
    key: "accessories",
    members: ["accessories"],
    name: "إكسسوارات",
    latin: "EXTRAS",
    line: "التفاصيل الصغيرة.",
    blurb: "ماصات وقطع مكمّلة لأكواب بف.",
    specs: [],
  },
];

export function familyOf(member: string): Family | undefined {
  return FAMILIES.find((f) => f.members.includes(member));
}

export function familyByKey(key: string): Family | undefined {
  return FAMILIES.find((f) => f.key === key);
}
