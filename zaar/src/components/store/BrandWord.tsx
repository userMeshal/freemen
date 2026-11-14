import type { CSSProperties } from "react";

/**
 * كلمة العلامة بحجم عملاق. اللاتينية تُقسّم حروفًا (كل حرف يتحرك وحده)،
 * والعربية تبقى كلمة واحدة حتى لا ينكسر اتصال الحروف.
 */
export function brandUnits(nameLatin: string, name: string): { units: string[]; latin: boolean } {
  const latin = nameLatin.trim().toUpperCase();
  if (latin.length >= 2 && latin.length <= 9) return { units: latin.split(""), latin: true };
  return { units: [name], latin: false };
}

export function BrandWord({
  nameLatin,
  name,
  unitClassName = "",
  wrapClassName = "",
  unitStyle,
}: {
  nameLatin: string;
  name: string;
  unitClassName?: string;
  /** صنف الغلاف الخارجي لكل وحدة — يستقبل الفهرس عبر {i} */
  wrapClassName?: string;
  unitStyle?: CSSProperties;
}) {
  const { units } = brandUnits(nameLatin, name);
  return (
    <>
      {units.map((u, i) => (
        <span key={i} className={wrapClassName.replace("{i}", String(i))}>
          <span className={unitClassName} style={{ ...unitStyle, ["--i" as string]: i }}>
            {u}
          </span>
        </span>
      ))}
    </>
  );
}

/** حجم الخط المناسب لعرض الشاشة بحسب عدد الحروف */
export function megaSize(nameLatin: string, name: string, base = 108): string {
  const { units, latin } = brandUnits(nameLatin, name);
  const n = latin ? units.length : Math.max(2, Array.from(name).length * 0.72);
  return `${Math.min(34, base / n).toFixed(1)}vw`;
}
