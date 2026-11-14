import type { ReactNode } from "react";
import Link from "next/link";
import { formatAmount } from "@/lib/money";

/** أدوات واجهة لوحتي التاجر وإدارة زار (مكونات خادم بلا حالة) */

export function PageHead({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-extrabold md:text-3xl">{title}</h1>
        {sub && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink/60">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}

export function Card({ children, className = "", title, action }: { children: ReactNode; className?: string; title?: string; action?: ReactNode }) {
  return (
    <section className={`dash-card p-5 md:p-6 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="font-display text-base font-bold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint, accent = false }: { label: string; value: ReactNode; hint?: ReactNode; accent?: boolean }) {
  return (
    <div className={`rounded-3xl border p-5 ${accent ? "border-transparent bg-ink text-paper" : "border-ink/10 bg-paper-card"}`}>
      <p className={`text-xs font-medium ${accent ? "text-paper/60" : "text-ink/55"}`}>{label}</p>
      <p className={`num mt-2 font-display text-[1.7rem] font-black leading-none md:text-3xl ${accent ? "text-accent" : ""}`}>{value}</p>
      {hint && <p className={`mt-2 text-xs ${accent ? "text-paper/55" : "text-ink/50"}`}>{hint}</p>}
    </div>
  );
}

export function Money({ value, className = "" }: { value: number; className?: string }) {
  return (
    <span className={`whitespace-nowrap ${className}`}>
      <span className="num font-semibold">{formatAmount(value)}</span> <span className="text-[0.8em] opacity-70">ر.س</span>
    </span>
  );
}

const TONES = {
  neutral: "bg-ink/[0.07] text-ink/70",
  good: "bg-emerald-500/15 text-emerald-700",
  warn: "bg-amber-500/20 text-amber-800",
  bad: "bg-red-500/15 text-red-700",
  info: "bg-sky-500/15 text-sky-700",
  ink: "bg-ink text-paper",
} as const;
export type Tone = keyof typeof TONES;

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[0.72rem] font-semibold ${TONES[tone]}`}>{children}</span>;
}

export const ORDER_TONE: Record<string, Tone> = {
  pending_payment: "warn",
  paid: "info",
  processing: "info",
  shipped: "ink",
  delivered: "good",
  cancelled: "neutral",
  refunded: "bad",
};

export function Empty({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-ink/20 px-6 py-14 text-center">
      <p className="font-display text-lg font-bold">{title}</p>
      {text && <p className="max-w-md text-sm leading-relaxed text-ink/60">{text}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="dash-card overflow-x-auto">{children}</div>;
}

export function Field({ label, hint, children, className = "" }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="dash-label">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs leading-relaxed text-ink/50">{hint}</span>}
    </label>
  );
}

export function Tabs({ items, current }: { items: { href: string; label: string; count?: number }[]; current: string }) {
  return (
    <nav className="no-scrollbar mb-5 flex gap-1.5 overflow-x-auto">
      {items.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            t.href === current ? "bg-ink text-paper" : "bg-ink/[0.06] text-ink/70 hover:bg-ink/10"
          }`}
        >
          {t.label}
          {typeof t.count === "number" && <span className="num text-xs opacity-70">{t.count}</span>}
        </Link>
      ))}
    </nav>
  );
}

export function fmtDate(d: Date | string | null | undefined, withTime = false): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", {
    timeZone: "Asia/Riyadh",
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
}
