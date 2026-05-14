export const products = [
  { id: 1, name: "Matcha Bowl", price: 149, emoji: "🍵", stock: 18, category: "أدوات ماتشا", status: "منشور" },
  { id: 2, name: "Swan Box", price: 89, emoji: "🦢", stock: 42, category: "هدايا", status: "منشور" },
  { id: 3, name: "Cold Matcha Cup", price: 39, emoji: "🥤", stock: 65, category: "أكواب", status: "منشور" },
  { id: 4, name: "Gift Set", price: 199, emoji: "🎁", stock: 12, category: "هدايا", status: "مخزون منخفض" },
  { id: 5, name: "Premium Matcha", price: 119, emoji: "🌿", stock: 28, category: "ماتشا", status: "منشور" },
  { id: 6, name: "Bamboo Whisk", price: 55, emoji: "🥢", stock: 34, category: "أدوات ماتشا", status: "منشور" }
];

export const orders = [
  { id: "#1024", customer: "نورة", total: "199 ر.س", status: "تم الدفع", payout: "قابل للتحويل", date: "اليوم", shipping: "قيد التجهيز" },
  { id: "#1025", customer: "سارة", total: "89 ر.س", status: "قيد التجهيز", payout: "معلق", date: "اليوم", shipping: "لم يشحن" },
  { id: "#1026", customer: "هند", total: "149 ر.س", status: "تم الشحن", payout: "بعد التسليم", date: "أمس", shipping: "تم الشحن" },
  { id: "#1027", customer: "لينا", total: "259 ر.س", status: "نزاع مفتوح", payout: "موقوف", date: "أمس", shipping: "موقوف" },
  { id: "#1028", customer: "ريم", total: "55 ر.س", status: "مكتمل", payout: "تم التحويل", date: "قبل يومين", shipping: "تم التسليم" }
];

export const customers = [
  { name: "نورة", phone: "05xxxxxxxx", orders: 3, total: "620 ر.س", type: "عميل متكرر" },
  { name: "سارة", phone: "05xxxxxxxx", orders: 1, total: "89 ر.س", type: "جديد" },
  { name: "هند", phone: "05xxxxxxxx", orders: 2, total: "348 ر.س", type: "عميل متكرر" },
  { name: "لينا", phone: "05xxxxxxxx", orders: 1, total: "259 ر.س", type: "تحت المراجعة" }
];

export const coupons = [
  { code: "WELCOME10", discount: "10%", usage: 18, status: "نشط" },
  { code: "FREESHIP", discount: "شحن مجاني", usage: 7, status: "نشط" },
  { code: "VIP20", discount: "20%", usage: 3, status: "متوقف" }
];

export const shippingMethods = [
  { name: "شحن محلي", company: "يدوي", price: "25 ر.س", duration: "2-5 أيام", status: "نشط" },
  { name: "استلام من المتجر", company: "بدون شركة", price: "0 ر.س", duration: "حسب الاتفاق", status: "نشط" },
  { name: "شحن سريع", company: "قريبًا", price: "35 ر.س", duration: "1-2 يوم", status: "قريبًا" }
];

export const paymentMethods = [
  { name: "تحويل بنكي", fee: "0%", status: "نشط" },
  { name: "رابط دفع يدوي", fee: "حسب المزود", status: "نشط" },
  { name: "مدى / Apple Pay", fee: "قريبًا", status: "تحت الربط" }
];

export const plans = [
  { name: "Free", price: "0 ر.س", desc: "للتجربة", features: ["20 منتج", "تحويل بعد 7 أيام", "عمولة 2.5%"] },
  { name: "Pro", price: "99 ر.س", desc: "للتاجر الجاد", features: ["100 منتج", "تحويل خلال 48 ساعة", "عمولة 1.5%"] },
  { name: "Business", price: "199 ر.س", desc: "للمتاجر النشطة", features: ["منتجات غير محدودة", "تحويل يومي", "عمولة 1%"] }
];
