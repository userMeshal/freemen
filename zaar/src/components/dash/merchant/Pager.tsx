import Link from "next/link";

/** ترقيم صفحات بسيط: السابق / التالي مع الحفاظ على باقي معايير البحث */
export function Pager({ base, params, page, pages }: { base: string; params: Record<string, string>; page: number; pages: number }) {
  if (pages <= 1) return null;
  const href = (p: number) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v));
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return s ? `${base}?${s}` : base;
  };
  return (
    <nav className="mt-5 flex items-center justify-between gap-3" aria-label="الصفحات">
      {page > 1 ? (
        <Link href={href(page - 1)} className="dash-btn dash-btn-ghost dash-btn-sm">
          السابق
        </Link>
      ) : (
        <span />
      )}
      <span className="text-xs text-ink/55">
        صفحة <span className="num font-semibold text-ink">{page}</span> من <span className="num">{pages}</span>
      </span>
      {page < pages ? (
        <Link href={href(page + 1)} className="dash-btn dash-btn-ghost dash-btn-sm">
          التالي
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
