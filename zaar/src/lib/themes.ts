import type { StorePalette, ThemeId } from "./types";

/**
 * الثيمات مأخوذة من تصاميم مواقعنا السابقة:
 *  - bold  «جريء»  ← تصميم PUFF SAUDI: كلمة عملاقة، تثبيت سينمائي بالتمرير، حبر/ورق ولون صارخ.
 *  - soft  «ناعم»  ← تصميم «حطّها»: شريط زجاجي عائم، هالات لونية، بطاقات هادئة ووضع داكن.
 */
export const THEMES: { id: ThemeId; name: string; origin: string; blurb: string }[] = [
  { id: "bold", name: "جريء", origin: "PUFF", blurb: "كلمة عملاقة، تمرير سينمائي ولون صارخ. للعلامات اللي تبي تنشاف." },
  { id: "soft", name: "ناعم", origin: "حطّها", blurb: "زجاج عائم وهالات لونية هادئة. للعلامات الراقية والهادئة." },
];

type Preset = Omit<StorePalette, "preset"> & { name: string };

export const PALETTES: Record<string, Preset> = {
  lime: { name: "ليموني", ink: "#0B0B0C", paper: "#F5F1E8", accent: "#D7FF3E", onAccent: "#0B0B0C", orbs: ["#D7FF3E", "#9BE7C4", "#FFE27A"], dark: false },
  coral: { name: "مرجاني", ink: "#120C0A", paper: "#F7EFE9", accent: "#FF5A36", onAccent: "#FFFFFF", orbs: ["#FFB489", "#FF8FA3", "#FFD9A0"], dark: false },
  sky: { name: "سماوي", ink: "#0A0D14", paper: "#EEF2F6", accent: "#4DA3FF", onAccent: "#07111F", orbs: ["#8FD6FF", "#B9A4FF", "#A8F0E2"], dark: false },
  gold: { name: "ذهبي", ink: "#0F0D08", paper: "#F6F1E4", accent: "#E8B84A", onAccent: "#1A1405", orbs: ["#F3D58A", "#E9B872", "#F7E6C4"], dark: false },
  rose: { name: "وردي", ink: "#140A0E", paper: "#F8EEF0", accent: "#FF7AA8", onAccent: "#2A0613", orbs: ["#FFB3CB", "#E5B8FF", "#FFD6C2"], dark: false },
  mint: { name: "نعناعي", ink: "#07110D", paper: "#EDF5F0", accent: "#19E28C", onAccent: "#04140C", orbs: ["#8FF0C2", "#8FD6FF", "#D9F7A1"], dark: false },
  violet: { name: "بنفسجي", ink: "#0D0A14", paper: "#F1EEF8", accent: "#8E6BFF", onAccent: "#FFFFFF", orbs: ["#B9A4FF", "#FFB0E0", "#8FD6FF"], dark: false },
  sand: { name: "رملي", ink: "#14110C", paper: "#F3ECDF", accent: "#C8875A", onAccent: "#FFFFFF", orbs: ["#E8C39E", "#D9A679", "#F2DFC4"], dark: false },
  sunset: { name: "غروب", ink: "#0D0D0D", paper: "#FFFFFF", accent: "#FF7A3D", onAccent: "#FFFFFF", orbs: ["#FFB489", "#B9A4FF", "#8FD6FF"], dark: false },
  night: { name: "ليلي", ink: "#F3F3F1", paper: "#0A0A0B", accent: "#D7FF3E", onAccent: "#0B0B0C", orbs: ["#FF9A66", "#A48CFF", "#5CC4FF"], dark: true },
};

export const PALETTE_IDS = Object.keys(PALETTES);

export function resolvePalette(id: string | undefined, theme: ThemeId): StorePalette {
  const key = id && PALETTES[id] ? id : theme === "soft" ? "sunset" : "lime";
  const { name: _n, ...p } = PALETTES[key];
  void _n;
  return { preset: key, ...p };
}

/** الأيقونات المسموحة للمنتجات والتصنيفات (أسماء lucide) */
export const ICONS = [
  "Sparkles", "Shirt", "Watch", "Coffee", "Gem", "Flower2", "Cake", "Gift", "Smartphone", "Headphones",
  "Gamepad2", "Sofa", "Lamp", "Baby", "Dumbbell", "BookOpen", "Palette", "Car", "PawPrint", "Leaf",
  "Droplets", "Candy", "Cookie", "Utensils", "ShoppingBag", "Glasses", "Footprints", "Crown", "Scissors", "Brush",
  "Camera", "Laptop", "House", "Tent", "Bike", "Pill", "HeartPulse", "Star", "Flame", "CupSoda",
  "Croissant", "IceCreamCone", "Wheat", "Package", "Wrench", "Music", "Plane", "Sun", "Moon", "Feather",
] as const;
export type IconName = (typeof ICONS)[number];

export const VERTICALS = [
  "perfumes", "fashion", "abayas", "coffee", "sweets", "food", "electronics", "gaming", "beauty", "jewelry",
  "home", "kids", "sports", "books", "gifts", "pets", "flowers", "health", "cars", "handmade", "general",
] as const;
