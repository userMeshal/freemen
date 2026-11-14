export type ImageDTO = {
  id: number;
  url: string;
  bg: string;
  accent: string;
  cutoutUrl: string | null;
  cutoutW: number | null;
  cutoutH: number | null;
  /** خلفية الصورة لون مسطّح (صورة منتج) وليست مشهدًا مصوّرًا */
  flat: boolean;
};

export type VariantDTO = {
  id: number;
  sku: string;
  optionValue: string | null;
  price: number;
  compareAtPrice: number | null;
  imageId: number | null;
  /** null = غير محدود */
  stock: number | null;
};

export type ProductCardDTO = {
  id: number;
  slug: string;
  name: string;
  family: string;
  capacityMl: number | null;
  colorName: string | null;
  price: number;
  compareAtPrice: number | null;
  optionName: string | null;
  isBestSeller: boolean;
  position: number;
  createdAt: string;
  searchText: string;
  categorySlugs: string[];
  image: ImageDTO | null;
  /** صور مصغّرة للمتغيرات (لعرض الألوان على البطاقة) */
  swatches: { variantId: number; label: string; accent: string; bg: string; url: string; flat: boolean }[];
  variantCount: number;
  /** يوجد عندما يكون للمنتج متغير واحد — للإضافة السريعة للسلة */
  quickVariantId: number | null;
  inStock: boolean;
};

export type ProductDTO = ProductCardDTO & {
  descriptionHtml: string;
  metaDescription: string | null;
  images: ImageDTO[];
  variants: VariantDTO[];
  categories: { slug: string; name: string }[];
};

export type CategoryDTO = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  count: number;
};

export type CartLineInput = { variantId: number; qty: number };

export type PricedLine = {
  variantId: number;
  productId: number;
  slug: string;
  name: string;
  optionName: string | null;
  optionValue: string | null;
  sku: string;
  imageUrl: string | null;
  bg: string;
  unitPrice: number;
  compareAtPrice: number | null;
  qty: number;
  total: number;
  /** الكمية القصوى المتاحة (null = غير محدود) */
  maxQty: number | null;
};

export type ShippingOption = {
  id: number;
  name: string;
  description: string | null;
  price: number;
  /** السعر بعد تطبيق الشحن المجاني إن وجد */
  effectivePrice: number;
  freeAbove: number | null;
};

export type CartQuote = {
  lines: PricedLine[];
  /** متغيرات لم تعد متاحة وتم استبعادها */
  removed: number[];
  adjusted: boolean;
  subtotal: number;
  discount: number;
  shipping: number;
  codFee: number;
  total: number;
  vatAmount: number;
  vatRate: number;
  coupon: { code: string; label: string } | null;
  couponError: string | null;
  shippingOptions: ShippingOption[];
  shippingMethodId: number | null;
  payment: { edfapay: boolean; cod: boolean; codFee: number };
};
