import Link from "next/link";
import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const inputCls =
  "block w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-ink-mute/60 focus:border-ink focus:ring-2 focus:ring-lime/60 disabled:bg-paper-deep/60";

export type BtnVariant = "primary" | "dark" | "outline" | "ghost" | "danger";

export function btnCls(variant: BtnVariant = "primary", size: "sm" | "md" = "md"): string {
  return clsx(
    "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50",
    size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2.5 text-sm",
    variant === "primary" && "bg-lime text-ink hover:bg-lime-deep",
    variant === "dark" && "bg-ink text-paper hover:bg-ink-soft",
    variant === "outline" && "border border-line bg-white text-ink hover:border-ink",
    variant === "ghost" && "text-ink hover:bg-paper-deep",
    variant === "danger" && "border border-coral/40 bg-white text-coral hover:bg-coral hover:text-white",
  );
}

export function LinkButton({
  href,
  variant = "outline",
  size = "md",
  children,
  className,
  ...rest
}: { href: string; variant?: BtnVariant; size?: "sm" | "md"; children: ReactNode; className?: string } & Omit<
  ComponentProps<typeof Link>,
  "href" | "className"
>) {
  return (
    <Link href={href} className={clsx(btnCls(variant, size), className)} {...rest}>
      {children}
    </Link>
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink md:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-ink-mute">{subtitle}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}

export function Card({
  title,
  actions,
  children,
  className,
  padded = true,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={clsx("rounded-2xl border border-line bg-white", className)}>
      {title || actions ? (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3.5">
          <h2 className="text-sm font-bold text-ink">{title}</h2>
          {actions}
        </header>
      ) : null}
      <div className={padded ? "p-5" : undefined}>{children}</div>
    </section>
  );
}

const TONES = {
  neutral: "bg-paper-deep text-ink-mute",
  green: "bg-emerald-100 text-emerald-800",
  amber: "bg-amber-100 text-amber-800",
  red: "bg-red-100 text-red-700",
  blue: "bg-sky-100 text-sky-800",
  lime: "bg-lime text-ink",
} as const;

export function Badge({ tone = "neutral", children }: { tone?: keyof typeof TONES; children: ReactNode }) {
  return (
    <span className={clsx("inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", TONES[tone])}>
      {children}
    </span>
  );
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={clsx("block", className)}>
      <span className="mb-1.5 block text-xs font-semibold text-ink-mute">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] leading-relaxed text-ink-mute/80">{hint}</span> : null}
    </label>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={clsx(inputCls, className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select className={clsx(inputCls, "appearance-auto", className)} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={clsx(inputCls, "min-h-24 leading-relaxed", className)} {...props} />;
}

export function Checkbox({ label, className, ...props }: { label: ReactNode } & ComponentProps<"input">) {
  return (
    <label className={clsx("inline-flex cursor-pointer items-center gap-2 text-sm text-ink", className)}>
      <input type="checkbox" className="h-4 w-4 rounded border-line accent-ink" {...props} />
      <span>{label}</span>
    </label>
  );
}

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className={clsx("w-full min-w-[640px] text-sm", className)}>{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th className={clsx("whitespace-nowrap border-b border-line bg-paper-card px-4 py-3 text-start text-xs font-semibold text-ink-mute", className)}>
      {children}
    </th>
  );
}

export function Td({ children, className, colSpan }: { children?: ReactNode; className?: string; colSpan?: number }) {
  return (
    <td colSpan={colSpan} className={clsx("border-b border-line/70 px-4 py-3 align-middle", className)}>
      {children}
    </td>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="px-5 py-12 text-center text-sm text-ink-mute">{children}</div>;
}

export function Pagination({
  page,
  totalPages,
  basePath,
  params = {},
}: {
  page: number;
  totalPages: number;
  basePath: string;
  params?: Record<string, string | undefined>;
}) {
  if (totalPages <= 1) return null;
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  return (
    <nav className="flex items-center justify-between gap-3 px-5 py-3.5 text-sm" aria-label="التنقل بين الصفحات">
      <span className="text-ink-mute">
        صفحة {page} من {totalPages}
      </span>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={href(page - 1)} className={btnCls("outline", "sm")}>
            <ChevronRight className="h-4 w-4" /> السابق
          </Link>
        ) : null}
        {page < totalPages ? (
          <Link href={href(page + 1)} className={btnCls("outline", "sm")}>
            التالي <ChevronLeft className="h-4 w-4" />
          </Link>
        ) : null}
      </div>
    </nav>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <div className="text-xs font-semibold text-ink-mute">{label}</div>
      <div className="mt-2 font-display text-2xl font-extrabold tracking-tight text-ink">{value}</div>
      {hint ? <div className="mt-1 text-[11px] text-ink-mute">{hint}</div> : null}
    </div>
  );
}

export function DefList({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="space-y-2.5 text-sm">
      {items.map(([k, v]) => (
        <div key={k} className="flex items-start justify-between gap-4">
          <dt className="shrink-0 text-ink-mute">{k}</dt>
          <dd className="text-end font-medium text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
