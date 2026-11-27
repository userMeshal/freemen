import Link from "next/link";
import { BellRing } from "lucide-react";
import { and, desc, eq, ilike, isNull, or, sql as dsql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { orders, type OrderStatus, type PaymentStatus } from "@/db/schema";
import { cancelStaleUnpaidOrders, ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/orders";
import { SOURCE_KEYS, SOURCE_LABEL, sourceText, type SourceKey } from "@/lib/attribution";
import { formatSar } from "@/lib/money";
import { displayPhone, toLatinDigits } from "@/lib/normalize";
import {
  ABANDONED_ORDER_SQL,
  CONFIRMED_ORDER_SQL,
  fmtDateTime,
  one,
  ORDER_STATUS_TONE,
  pageNumber,
  PAYMENT_STATUS_TONE,
} from "@/lib/admin-utils";
import { Badge, Card, EmptyState, Input, LinkButton, PageHeader, Pagination, Select, Table, Td, Th, btnCls } from "@/components/admin/ui";

export const metadata = { title: "الطلبات" };

const PER_PAGE = 20;
const STATUSES = Object.keys(ORDER_STATUS_LABEL) as OrderStatus[];
const PAYMENTS = Object.keys(PAYMENT_STATUS_LABEL) as PaymentStatus[];

/** confirmed = طلبات تُجهَّز وتُشحن ، abandoned = وصل العميل للدفع ولم يُكمل ، all = الكل */
type View = "confirmed" | "abandoned" | "all";
const VIEW_SQL: Record<View, string | null> = {
  confirmed: CONFIRMED_ORDER_SQL,
  abandoned: ABANDONED_ORDER_SQL,
  all: null,
};

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = one(sp.q);
  const status = one(sp.status);
  const payment = one(sp.payment);
  const source = one(sp.source);
  const page = pageNumber(sp.page);
  const viewParam = one(sp.view);
  const view: View = viewParam === "abandoned" || viewParam === "all" ? viewParam : "confirmed";
  const abandoned = view === "abandoned";

  await cancelStaleUnpaidOrders().catch(() => 0);

  const conds: SQL[] = [];
  const viewSql = VIEW_SQL[view];
  if (viewSql) conds.push(dsql.raw(viewSql));
  if (q) {
    const text = `%${q.replace(/[%_]/g, "")}%`;
    const digits = toLatinDigits(q).replace(/\D/g, "").replace(/^(00966|966|0)/, "");
    const parts: SQL[] = [ilike(orders.number, text), ilike(orders.customerName, text)];
    if (digits.length >= 3) parts.push(ilike(orders.customerPhone, `%${digits}%`));
    conds.push(or(...parts)!);
  }
  if (STATUSES.includes(status as OrderStatus)) conds.push(eq(orders.status, status as OrderStatus));
  if (PAYMENTS.includes(payment as PaymentStatus)) conds.push(eq(orders.paymentStatus, payment as PaymentStatus));
  if (SOURCE_KEYS.includes(source as SourceKey)) conds.push(eq(orders.source, source));
  else if (source === "unknown") conds.push(isNull(orders.source));
  const where = conds.length ? and(...conds) : undefined;

  const [rows, total, tabCounts] = await Promise.all([
    db
      .select()
      .from(orders)
      .where(where)
      .orderBy(desc(orders.createdAt), desc(orders.id))
      .limit(PER_PAGE)
      .offset((page - 1) * PER_PAGE),
    db.select({ c: dsql<number>`count(*)::int` }).from(orders).where(where),
    db
      .select({
        confirmed: dsql<number>`count(*) filter (where ${dsql.raw(CONFIRMED_ORDER_SQL)})::int`,
        abandoned: dsql<number>`count(*) filter (where ${dsql.raw(ABANDONED_ORDER_SQL)})::int`,
        all: dsql<number>`count(*)::int`,
      })
      .from(orders),
  ]);
  const count = total[0]?.c ?? 0;
  const filtered = Boolean(q || status || payment || source);
  const basePath = view === "confirmed" ? "/admin/orders" : `/admin/orders?view=${view}`;
  const tabs: { key: View; label: string; href: string; n: number }[] = [
    { key: "confirmed", label: "الطلبات", href: "/admin/orders", n: tabCounts[0]?.confirmed ?? 0 },
    { key: "abandoned", label: "سلات متروكة", href: "/admin/orders?view=abandoned", n: tabCounts[0]?.abandoned ?? 0 },
    { key: "all", label: "الكل", href: "/admin/orders?view=all", n: tabCounts[0]?.all ?? 0 },
  ];

  return (
    <>
      <PageHeader
        title={abandoned ? "سلات متروكة" : "الطلبات"}
        subtitle={`${count.toLocaleString("en-US")} ${abandoned ? "سلة" : "طلب"}`}
      >
        <LinkButton href="/admin/settings#notifications">
          <BellRing className="h-4 w-4" /> إشعارات الطلبات
        </LinkButton>
      </PageHeader>

      <nav className="mb-4 flex flex-wrap gap-2" aria-label="تبويبات الطلبات">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            aria-current={t.key === view ? "page" : undefined}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
              t.key === view ? "border-ink bg-ink text-paper" : "border-line bg-white text-ink hover:border-ink"
            }`}
          >
            {t.label}
            <span className={`rounded-full px-2 py-0.5 text-[11px] ${t.key === view ? "bg-paper/20" : "bg-paper-card text-ink-mute"}`}>
              {t.n.toLocaleString("en-US")}
            </span>
          </Link>
        ))}
      </nav>

      <p className="mb-4 text-xs leading-relaxed text-ink-mute">
        {view === "confirmed"
          ? "تظهر هنا الطلبات المدفوعة وطلبات الدفع عند الاستلام فقط — هذه التي تُجهَّز وتُشحن."
          : abandoned
            ? "عملاء وصلوا إلى صفحة الدفع ولم يُكملوه. لا تُشحن — تُلغى تلقائيًا بعد ساعتين ويعود مخزونها، ويمكنك التواصل مع العميل لإكمال طلبه."
            : "كل الطلبات: المؤكدة والتي لم يكتمل دفعها."}
      </p>

      <Card className="mb-4">
        <form method="get" className={`grid gap-3 ${abandoned ? "md:grid-cols-[1fr_180px_auto]" : "md:grid-cols-[1fr_160px_160px_160px_auto]"}`}>
          {view !== "confirmed" ? <input type="hidden" name="view" value={view} /> : null}
          <Input name="q" defaultValue={q} placeholder="بحث برقم الطلب، الجوال أو الاسم" aria-label="بحث" />
          {abandoned ? null : (
            <>
          <Select name="status" defaultValue={status} aria-label="حالة الطلب">
                <option value="">كل الحالات</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {ORDER_STATUS_LABEL[s]}
                  </option>
                ))}
              </Select>
              <Select name="payment" defaultValue={payment} aria-label="حالة الدفع">
                <option value="">كل حالات الدفع</option>
                {PAYMENTS.map((s) => (
                  <option key={s} value={s}>
                    {PAYMENT_STATUS_LABEL[s]}
                  </option>
                ))}
              </Select>
            </>
          )}
          <Select name="source" defaultValue={source} aria-label="مصدر الطلب">
            <option value="">كل المصادر</option>
            {SOURCE_KEYS.map((k) => (
              <option key={k} value={k}>
                {SOURCE_LABEL[k]}
              </option>
            ))}
            <option value="unknown">غير معروف</option>
          </Select>
          <div className="flex gap-2">
            <button type="submit" className={btnCls("dark")}>
              تصفية
            </button>
            {filtered ? <LinkButton href={basePath}>مسح</LinkButton> : null}
          </div>
        </form>
      </Card>

      <Card padded={false}>
        {rows.length ? (
          <Table>
            <thead>
              <tr>
                <Th>رقم الطلب</Th>
                <Th>العميل</Th>
                <Th>الجوال</Th>
                <Th>الإجمالي</Th>
                <Th>الحالة</Th>
                <Th>الدفع</Th>
                <Th>الطريقة</Th>
                <Th>المصدر</Th>
                <Th>التاريخ</Th>
                {abandoned ? <Th>تواصل</Th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id} className="hover:bg-paper-card">
                  <Td>
                    <Link href={`/admin/orders/${o.id}`} className="font-bold hover:underline" dir="ltr">
                      {o.number}
                    </Link>
                  </Td>
                  <Td>{o.customerName}</Td>
                  <Td>
                    <span dir="ltr">{displayPhone(o.customerPhone)}</span>
                  </Td>
                  <Td className="whitespace-nowrap font-semibold">{formatSar(o.total)}</Td>
                  <Td>
                    <Badge tone={ORDER_STATUS_TONE[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Badge>
                  </Td>
                  <Td>
                    <Badge tone={PAYMENT_STATUS_TONE[o.paymentStatus]}>{PAYMENT_STATUS_LABEL[o.paymentStatus]}</Badge>
                  </Td>
                  <Td className="whitespace-nowrap text-ink-mute">{o.paymentMethod === "cod" ? "عند الاستلام" : "إلكتروني"}</Td>
                  <Td className="whitespace-nowrap">
                    {o.attribution ? (
                      <Badge tone={o.attribution.paid ? "lime" : o.attribution.platform === "direct" ? "neutral" : "blue"}>{sourceText(o.attribution, true)}</Badge>
                    ) : (
                      <span className="text-ink-mute">—</span>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap text-ink-mute">{fmtDateTime(o.createdAt)}</Td>
                  {abandoned ? (
                    <Td>
                      <a
                        href={`https://wa.me/${o.customerPhone}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="whitespace-nowrap font-semibold underline underline-offset-4 hover:no-underline"
                      >
                        واتساب
                      </a>
                    </Td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState>
            {filtered ? "لا توجد نتائج مطابقة للتصفية." : abandoned ? "لا توجد سلات متروكة." : "لا توجد طلبات بعد."}
          </EmptyState>
        )}
        <Pagination page={page} totalPages={Math.ceil(count / PER_PAGE)} basePath="/admin/orders" params={{ view: view === "confirmed" ? undefined : view, q, status, payment, source }} />
      </Card>
    </>
  );
}
