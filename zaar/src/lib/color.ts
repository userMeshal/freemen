/** "#D7FF3E" → "215 255 62" لاستخدامه في متغيرات Tailwind */
export function hexTriplet(hex: string): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padEnd(6, "0").slice(0, 6);
  const n = parseInt(full, 16);
  return Number.isNaN(n) ? "0 0 0" : `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

export const artBg = (hue: number) => `hsl(${hue} 70% 88%)`;
export const artAccent = (hue: number) => `hsl(${hue} 85% 58%)`;
