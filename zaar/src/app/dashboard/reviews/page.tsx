import Link from "next/link";
import { and, desc, eq, sql } from "drizzle-orm";
import { Eye, EyeOff, Star } from "lucide-react";
import { db } from "@/db";
import { products, reviews } from "@/db/schema";
import { ActionButton } from "@/components/dash/client";
import { Pager } from "@/components/dash/merchant/Pager";
import { Badge, Empty, PageHead, Stat, fmtDate } from "@/components/dash/ui";
import { requireMerchantStore } from "@/lib/auth";
import { pageOf } from "../_lib/form";
import { toggleReview } from "./actions";

export const metadata = { title: "التقييمات" };

const PER_PAGE = 30;

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex gap-0.5" role="img" aria-label={`${rating} من 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={15} className={n <= rating ? "fill-amber-400 text-amber-400" : "text-ink/20"} />
      ))}
    </span>
  );
}

export default async function ReviewsPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { store } = await requireMerchantStore();
  const page = pageOf((await props.searchParams).page);

  const [stats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      shown: sql<number>`(count(*) filter (where not ${reviews.hidden}))::int`,
      avg: sql<number | null>`(avg(${reviews.rating}) filter (where not ${reviews.hidden}))::float`,
    })
    .from(reviews)
    .where(eq(reviews.storeId, store.id));
  const pages = Math.max(1, Math.ceil(stats.total / PER_PAGE));
  const current = Math.min(page, pages);

  const rows = await db
    .select({
      id: reviews.id,
      name: reviews.name,
      rating: reviews.rating,
      body: reviews.body,
      hidden: reviews.hidden,
      createdAt: reviews.createdAt,
      productId: reviews.productId,
      productName: products.name,
    })
    .from(reviews)
    .innerJoin(products, and(eq(products.id, reviews.productId), eq(products.storeId, store.id)))
    .where(eq(reviews.storeId, store.id))
    .orderBy(desc(reviews.createdAt), desc(reviews.id))
    .limit(PER_PAGE)
    .offset((current - 1) * PER_PAGE);

  return (
    <>
      <PageHead title="التقييمات" sub="تقييمات عملائك اللي اشتروا فعلًا. تقدر تخفي أي تقييم مسيء، والمخفي ما يدخل في متوسط التقييم." />

      {stats.total === 0 ? (
        <Empty title="ما وصلك تقييمات للحين" text="تقييمات العملاء اللي اشتروا من متجرك بتظهر هنا وفي صفحة المنتج." />
      ) : (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            <Stat label="متوسط التقييم" value={stats.avg === null ? "—" : stats.avg.toFixed(1)} hint="من 5" accent />
            <Stat label="تقييمات ظاهرة" value={stats.shown} />
            <Stat label="تقييمات مخفية" value={stats.total - stats.shown} />
          </div>

          <ul className="space-y-3">
            {rows.map((r) => (
              <li key={r.id} className={`dash-card p-5 ${r.hidden ? "opacity-70" : ""}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <Stars rating={r.rating} />
                      <span className="text-sm font-semibold">{r.name}</span>
                      {r.hidden && <Badge>مخفي</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-ink/55">
                      <Link href={`/dashboard/products/${r.productId}`} className="font-medium text-ink/75 underline-offset-4 hover:underline">
                        {r.productName}
                      </Link>{" "}
                      · {fmtDate(r.createdAt)}
                    </p>
                  </div>
                  <ActionButton action={toggleReview} fields={{ id: r.id }}>
                    {r.hidden ? <Eye size={14} /> : <EyeOff size={14} />}
                    {r.hidden ? "إظهار" : "إخفاء"}
                  </ActionButton>
                </div>
                {r.body ? <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink/80">{r.body}</p> : <p className="mt-3 text-sm text-ink/45">بدون تعليق.</p>}
              </li>
            ))}
          </ul>
          <Pager base="/dashboard/reviews" params={{}} page={current} pages={pages} />
        </>
      )}
    </>
  );
}
