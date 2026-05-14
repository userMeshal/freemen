export const platformName = "فريمان";

export const plans = [
  {
    name: "Free",
    price: "0 ر.س",
    description: "للتجربة والبداية",
    features: ["حتى 20 منتج", "تحويل بعد 7 أيام", "عمولة 2.5%", "متجر بسيط"],
  },
  {
    name: "Pro",
    price: "99 ر.س",
    description: "للتاجر الجاد",
    featured: true,
    features: ["حتى 100 منتج", "تحويل خلال 48 ساعة", "عمولة 1.5%", "ثيمات أفضل"],
  },
  {
    name: "Business",
    price: "199 ر.س",
    description: "للمتاجر النشطة",
    features: ["منتجات غير محدودة", "تحويل يومي", "عمولة 1%", "دعم أسرع"],
  },
];

export const demoStore = {
  name: "Swan Matcha",
  slug: "swan",
  tagline: "ماتشا فاخر ومنتجات هدايا ناعمة",
  banner: "متجر ماتشا فاخر — Powered by Freeman",
  products: [
    { id: 1, name: "Matcha Bowl", price: 149, emoji: "🍵", stock: 18 },
    { id: 2, name: "Swan Box", price: 89, emoji: "🦢", stock: 42 },
    { id: 3, name: "Cold Matcha Cup", price: 39, emoji: "🥤", stock: 65 },
    { id: 4, name: "Gift Set", price: 199, emoji: "🎁", stock: 12 },
  ],
};

export const orders = [
  { id: "#1024", customer: "نورة", total: "199 ر.س", status: "تم الدفع", payout: "قابل للتحويل" },
  { id: "#1025", customer: "سارة", total: "89 ر.س", status: "قيد التجهيز", payout: "معلق" },
  { id: "#1026", customer: "هند", total: "149 ر.س", status: "تم الشحن", payout: "بعد التسليم" },
  { id: "#1027", customer: "لينا", total: "259 ر.س", status: "نزاع مفتوح", payout: "موقوف" },
];
