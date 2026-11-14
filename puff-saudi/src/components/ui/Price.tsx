import { discountPercent, formatAmount } from "@/lib/money";

export function Price({
  price,
  compareAt,
  from = false,
  className = "",
  size = "md",
}: {
  price: number;
  compareAt?: number | null;
  from?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const main = size === "lg" ? "text-3xl md:text-4xl" : size === "sm" ? "text-sm" : "text-base";
  const cur = size === "lg" ? "text-base" : "text-xs";
  return (
    <span className={`inline-flex items-baseline gap-2 ${className}`}>
      {from && <span className="text-xs text-ink-mute">من</span>}
      <span className={`font-display font-bold ${main}`}>
        <span className="num">{formatAmount(price)}</span> <span className={`${cur} font-medium`}>ر.س</span>
      </span>
      {compareAt && compareAt > price ? (
        <s className={`num text-ink-mute/80 ${size === "lg" ? "text-lg" : "text-xs"}`}>{formatAmount(compareAt)}</s>
      ) : null}
    </span>
  );
}

export function SaleBadge({ price, compareAt, className = "" }: { price: number; compareAt?: number | null; className?: string }) {
  const pct = discountPercent(price, compareAt);
  if (!pct) return null;
  return (
    <span
      className={`inline-flex items-center rounded-full bg-ink px-2.5 py-1 font-display text-[0.68rem] font-bold text-lime ${className}`}
    >
      <span className="num">-{pct}%</span>
    </span>
  );
}
