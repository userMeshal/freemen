"use client";

import type { ReactNode } from "react";
import { Star } from "lucide-react";
import { discountPercent, formatAmount } from "@/lib/money";
import { useStore } from "./ctx";

/**
 * أصناف مشتركة تتبدّل بحسب ثيم المتجر، حتى تُكتب الصفحات المشتركة
 * (المنتج، السلة، الدفع، تتبع الطلب) مرة واحدة وتظهر بهوية كل ثيم.
 */
const BOLD = {
  page: "wrap pb-24 pt-[calc(var(--header-h)+2.5rem)] md:pt-[calc(var(--header-h)+4rem)]",
  h1: "t-h1 !text-[clamp(2.1rem,5.4vw,4.6rem)]",
  h2: "t-h3",
  eyebrow: "t-eyebrow text-ink/60",
  lead: "text-base leading-loose text-ink/70",
  btn: "btn btn-ink",
  btnGhost: "btn btn-ghost",
  btnBlock: "btn btn-ink w-full !min-h-[3.6rem] !text-base",
  input: "field",
  label: "label",
  panel: "bg-paper-card rounded-tile border border-line p-5 md:p-7",
  chip: "inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-ink/15 px-4 py-2 text-sm transition-colors duration-300 hover:border-ink",
  chipOn: "inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-ink bg-ink px-4 py-2 text-sm text-paper",
  muted: "text-ink/60",
  error: "rounded-2xl bg-coral/10 px-4 py-3 text-sm font-medium text-coral",
  ok: "rounded-2xl bg-accent/30 px-4 py-3 text-sm font-medium",
  media: "overflow-hidden rounded-tile",
  prose: "prose-store",
};
const SOFT: typeof BOLD = {
  page: "s-container s-page",
  h1: "s-detail-title",
  h2: "s-h3 !mb-3",
  eyebrow: "s-eyebrow",
  lead: "s-lead",
  btn: "s-btn s-btn-primary",
  btnGhost: "s-btn s-btn-ghost",
  btnBlock: "s-btn s-btn-primary s-btn-lg s-btn-block",
  input: "s-input",
  label: "s-label",
  panel: "s-wants-box",
  chip: "s-chip s-chip-lg s-chip-btn",
  chipOn: "s-chip s-chip-lg s-chip-solid",
  muted: "text-[color:var(--muted)]",
  error: "s-form-error",
  ok: "s-form-ok",
  media: "overflow-hidden rounded-[34px]",
  prose: "s-policy",
};

export function useT() {
  const { store } = useStore();
  return store.theme === "soft" ? SOFT : BOLD;
}

export function Price({ price, compareAt, size = "md", from = false }: { price: number; compareAt?: number | null; size?: "sm" | "md" | "lg"; from?: boolean }) {
  const main = size === "lg" ? "text-3xl md:text-4xl" : size === "sm" ? "text-sm" : "text-base";
  const cur = size === "lg" ? "text-base" : "text-xs";
  return (
    <span className="inline-flex items-baseline gap-2">
      {from && <span className="text-xs opacity-60">من</span>}
      <span className={`font-display font-bold ${main}`}>
        <span className="num">{formatAmount(price)}</span> <span className={`${cur} font-medium`}>ر.س</span>
      </span>
      {compareAt && compareAt > price ? <s className={`num opacity-50 ${size === "lg" ? "text-lg" : "text-xs"}`}>{formatAmount(compareAt)}</s> : null}
    </span>
  );
}

export function SaleBadge({ price, compareAt }: { price: number; compareAt?: number | null }) {
  const pct = discountPercent(price, compareAt);
  if (!pct) return null;
  return (
    <span className="inline-flex items-center rounded-full bg-ink px-2.5 py-1 font-display text-[0.68rem] font-bold text-accent">
      <span className="num">-{pct}%</span>
    </span>
  );
}

export function Stars({ value, count, size = 14 }: { value: number | null; count?: number; size?: number }) {
  if (!value) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs" aria-label={`التقييم ${value} من 5`}>
      <Star size={size} className="fill-amber-400 text-amber-400" />
      <span className="num font-semibold">{value.toFixed(1)}</span>
      {typeof count === "number" && <span className="num opacity-55">({count})</span>}
    </span>
  );
}

export function PageTitle({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  const t = useT();
  return (
    <header className="mb-8 md:mb-12">
      {eyebrow && <p className={t.eyebrow}>{eyebrow}</p>}
      <h1 className={`${t.h1} mt-2`}>{title}</h1>
      {children}
    </header>
  );
}
