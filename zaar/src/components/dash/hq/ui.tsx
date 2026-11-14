import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** مكونات خادم صغيرة تخص لوحة إدارة زار */

export function Pager({ page, pages, href }: { page: number; pages: number; href: (page: number) => string }) {
  if (pages <= 1) return null;
  const cls = "dash-btn dash-btn-ghost dash-btn-sm";
  return (
    <nav className="mt-5 flex items-center justify-between gap-3" aria-label="تنقّل الصفحات">
      {page > 1 ? (
        <Link href={href(page - 1)} className={cls}>
          <ChevronRight size={15} /> السابق
        </Link>
      ) : (
        <span className={`${cls} opacity-40`} aria-disabled="true">
          <ChevronRight size={15} /> السابق
        </span>
      )}
      <span className="text-xs text-ink/55">
        صفحة <span className="num font-semibold text-ink">{page}</span> من <span className="num font-semibold text-ink">{pages}</span>
      </span>
      {page < pages ? (
        <Link href={href(page + 1)} className={cls}>
          التالي <ChevronLeft size={15} />
        </Link>
      ) : (
        <span className={`${cls} opacity-40`} aria-disabled="true">
          التالي <ChevronLeft size={15} />
        </span>
      )}
    </nav>
  );
}

/** ملاحظة توضيحية أو تحذير أعلى الصفحة */
export function Note({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warn" | "bad" }) {
  const cls = {
    info: "bg-ink/[0.05] text-ink/75",
    warn: "bg-amber-500/15 text-amber-900",
    bad: "bg-red-500/10 text-red-700",
  }[tone];
  return (
    <div role={tone === "info" ? undefined : "alert"} className={`mb-5 rounded-3xl px-5 py-4 text-sm leading-relaxed ${cls}`}>
      {children}
    </div>
  );
}

/** سطر «عنوان: قيمة» داخل بطاقات التفاصيل */
export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-ink/[0.07] py-2.5 text-sm last:border-b-0">
      <dt className="text-ink/55">{label}</dt>
      <dd className="min-w-0 break-words text-end font-medium">{children}</dd>
    </div>
  );
}
