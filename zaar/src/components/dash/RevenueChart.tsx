"use client";

import { useState } from "react";
import { formatAmount } from "@/lib/money";

type Point = { day: string; revenue: number; orders: number; views: number };

const label = (day: string) => new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));

/** مبيعات آخر 30 يومًا: أعمدة رفيعة بسلسلة واحدة، مع تلميح عند المرور وجدول بديل لقارئات الشاشة */
export function RevenueChart({ points }: { points: Point[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...points.map((p) => p.revenue), 1);
  const ticks = [1, 0.5, 0];
  const active = hover !== null ? points[hover] : null;

  return (
    <figure>
      <div className="relative h-52" onMouseLeave={() => setHover(null)}>
        {/* خطوط إرشادية خافتة */}
        {ticks.map((t) => (
          <div key={t} className="pointer-events-none absolute inset-x-0 flex items-center gap-2" style={{ bottom: `${t * 100}%` }}>
            <span className="num w-12 shrink-0 text-end text-[0.65rem] text-ink/40">{t === 0 ? "0" : formatAmount(Math.round((max * t) / 100) * 100)}</span>
            <span className="h-px flex-1 bg-ink/[0.07]" />
          </div>
        ))}
        <div className="absolute inset-y-0 end-0 start-14 flex items-end gap-[2px]" dir="ltr">
          {points.map((p, i) => (
            <button
              key={p.day}
              type="button"
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              aria-label={`${label(p.day)}: ${formatAmount(p.revenue)} ر.س من ${p.orders} طلب`}
              className="group relative flex h-full flex-1 items-end outline-none"
            >
              <span
                className={`w-full rounded-t-[4px] transition-colors ${hover === i ? "bg-ink" : p.revenue ? "bg-ink/70 group-focus-visible:bg-ink" : "bg-ink/10"}`}
                style={{ height: p.revenue ? `${Math.max(3, (p.revenue / max) * 100)}%` : "2px" }}
              />
            </button>
          ))}
        </div>
        {active && hover !== null && (
          <div
            role="status"
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-2xl bg-ink px-3.5 py-2.5 text-xs text-paper shadow-xl"
            style={{ left: `calc(3.5rem + (100% - 3.5rem) * ${(hover + 0.5) / points.length})` }}
          >
            <p className="font-semibold">{label(active.day)}</p>
            <p className="mt-1">
              <span className="num font-display text-sm font-bold">{formatAmount(active.revenue)}</span> ر.س
            </p>
            <p className="text-paper/60">
              <span className="num">{active.orders}</span> طلب · <span className="num">{active.views}</span> زيارة
            </p>
          </div>
        )}
      </div>
      <div className="mt-2 flex justify-between ps-14 text-[0.68rem] text-ink/45" dir="ltr">
        <span>{label(points[0].day)}</span>
        <span>{label(points[Math.floor(points.length / 2)].day)}</span>
        <span>{label(points[points.length - 1].day)}</span>
      </div>
      <table className="sr-only">
        <caption>المبيعات اليومية لآخر 30 يومًا</caption>
        <thead>
          <tr>
            <th>اليوم</th>
            <th>المبيعات (ر.س)</th>
            <th>الطلبات</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.day}>
              <td>{p.day}</td>
              <td>{p.revenue / 100}</td>
              <td>{p.orders}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
