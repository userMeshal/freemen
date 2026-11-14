import Link from "next/link";
import { db } from "@/db";
import { pages } from "@/db/schema";
import { fmtDateTime, one } from "@/lib/admin-utils";
import { Card, PageHeader } from "@/components/admin/ui";
import { PageEditor } from "@/components/admin/PageEditor";
import { savePageAction } from "./actions";

export const metadata = { title: "الصفحات" };

const SLUGS = [
  { slug: "privacy", label: "سياسة الخصوصية" },
  { slug: "returns", label: "سياسة الاسترداد" },
  { slug: "shipping", label: "الشحن والتوصيل" },
  { slug: "terms", label: "شروط الخدمة" },
  { slug: "contact", label: "تواصل معنا" },
] as const;

export default async function AdminPagesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const requested = one((await searchParams).slug);
  const current = SLUGS.find((s) => s.slug === requested) ?? SLUGS[0];
  const rows = await db.select().from(pages);
  const bySlug = new Map(rows.map((r) => [r.slug, r]));
  const page = bySlug.get(current.slug);
  const stale = rows.filter((r) => /shopify|suy\b|suysaudi/i.test(r.bodyHtml)).map((r) => r.slug);

  return (
    <>
      <PageHeader title="الصفحات" subtitle="صفحات السياسات والتواصل التي تظهر في تذييل المتجر" />

      {stale.length ? (
        <p className="mb-4 rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm font-medium leading-7 text-amber-800">
          تنبيه: بعض الصفحات المنقولة من المتجر القديم ما زالت تذكر «Shopify» أو «SUY / Suysaudi» —
          راجعها وعدّل نصها ليطابق متجرك الحالي:{" "}
          {stale.map((s) => SLUGS.find((x) => x.slug === s)?.label ?? s).join("، ")}.
        </p>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-2">
        {SLUGS.map((s) => (
          <Link
            key={s.slug}
            href={`/admin/pages?slug=${s.slug}`}
            className={
              "rounded-full border px-4 py-2 text-sm font-semibold transition " +
              (s.slug === current.slug ? "border-ink bg-ink text-paper" : "border-line bg-white text-ink hover:border-ink")
            }
          >
            {s.label}
          </Link>
        ))}
      </div>

      <Card
        title={current.label}
        actions={
          <span className="flex items-center gap-3 text-xs text-ink-mute">
            {page ? `آخر تحديث ${fmtDateTime(page.updatedAt)}` : "لم تُنشأ بعد"}
            <Link href={`/pages/${current.slug}`} target="_blank" className="font-semibold underline hover:text-ink">
              عرض في المتجر
            </Link>
          </span>
        }
      >
        <PageEditor
          key={current.slug}
          slug={current.slug}
          title={page?.title ?? current.label}
          bodyHtml={page?.bodyHtml ?? ""}
          action={savePageAction}
        />
      </Card>
    </>
  );
}
