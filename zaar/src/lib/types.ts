/** أنواع مشتركة بين الخادم والواجهة — بلا أي استيراد خاص بالخادم */

export type ThemeId = "bold" | "soft";

export type StorePalette = {
  preset: string;
  ink: string;
  paper: string;
  /** لون العلامة الأساسي */
  accent: string;
  /** لون النص فوق accent */
  onAccent: string;
  /** هالات الخلفية (ثيم ناعم) وشخابيط الشعار */
  orbs: [string, string, string];
  dark: boolean;
};

export type StoreStat = { value: number; unit: string; label: string };
export type StoreFeature = { icon: string; title: string; text: string };

export type StoreContent = {
  /** ثلاث كلمات/عبارات قصيرة للعنوان الافتتاحي */
  headline: string[];
  heroText: string;
  manifesto: string;
  accentWords: string[];
  stats: StoreStat[];
  features: StoreFeature[];
  marquee: string[];
  announcement: string;
  ctaTitle: string;
  ctaText: string;
  shippingPolicy: string;
  returnsPolicy: string;
};

export type StoreSettings = {
  email: string;
  phone: string;
  whatsapp: string;
  instagram: string;
  tiktok: string;
  snapchat: string;
  x: string;
  crNumber: string;
  vatNumber: string;
  vatRate: number;
  /** بالهللة */
  shippingFee: number;
  /** 0 = لا يوجد شحن مجاني */
  freeShippingOver: number;
  shippingDays: string;
  metaPixelId: string;
  tiktokPixelId: string;
  snapPixelId: string;
};

export type ProductArt = { hue: number; icon: string };
export type ProductOption = { name: string; values: string[] };

export type OrderEvent = { at: string; type: string; note: string; by: "system" | "merchant" | "customer" | "zaar" };

export type CartLine = {
  productId: number;
  slug: string;
  name: string;
  optionValue: string | null;
  unitPrice: number;
  qty: number;
  image: string | null;
  art: ProductArt;
};

/** ما تحتاجه الواجهة لعرض بطاقة منتج */
export type ProductCardDTO = {
  id: number;
  slug: string;
  name: string;
  price: number;
  compareAtPrice: number | null;
  image: string | null;
  art: ProductArt;
  inStock: boolean;
  isFeatured: boolean;
  categoryId: number | null;
  categoryName: string | null;
  option: ProductOption | null;
  rating: number | null;
  reviewsCount: number;
};

export type ProductDTO = ProductCardDTO & {
  description: string;
  images: string[];
  stock: number | null;
};

export type CategoryDTO = { id: number; slug: string; name: string; icon: string; count: number };

/** نسخة المتجر الآمنة للإرسال إلى المتصفح */
export type StoreDTO = {
  id: number;
  slug: string;
  name: string;
  nameLatin: string;
  tagline: string;
  description: string;
  vertical: string;
  theme: ThemeId;
  palette: StorePalette;
  content: StoreContent;
  settings: StoreSettings;
  status: "draft" | "live" | "suspended";
  /** بادئة الروابط: "/s/slug" على الدومين الرئيسي و "" على النطاق الفرعي */
  base: string;
};

export type PaymentMethodId = "card" | "tabby" | "tamara";
export type PaymentOption = { id: PaymentMethodId; label: string; note: string; test: boolean };

export type Quote = {
  lines: (CartLine & { lineTotal: number; available: boolean })[];
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  vat: number;
  coupon: { code: string; label: string } | null;
  couponError: string | null;
  freeShippingLeft: number;
};
