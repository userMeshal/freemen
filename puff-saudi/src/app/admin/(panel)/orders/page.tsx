import Link from "next/link";
import { and, desc, eq, ilike, or, sql as dsql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { orders, type OrderStatus, type PaymentStatus } from "@/db/schema";
import { cancelStaleUnpaidOrders, ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/orders";
import { formatSar } from "@/lib/money";
import { displayPhone, toLatinDigits } from "@/lib/normalize";
import { fmtDateTime, one, ORDER_STATUS_TONE, pageNumber, PAYMENT_STATUS_TONE } from "@/lib/admin-utils";
import { Badge, Card, EmptyState, Input, LinkButton, PageHeader, Pagination, Select, Table, Td, Th, btnCls } from "@/components/admin/ui";

export const metadata = { title: "الطلبات" };

const PER_PAGE = 20;
const STATUSES = Object.keys(ORDER_STATUS_LABEL) as OrderStatus[];
const PAYMENTS = Object.keys(PAYMENT_STATUS_LABEL) as PaymentStatus[];

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = one(sp.q);
  const status = one(sp.status);
  const payment = one(sp.payment);
  const page = pageNumber(sp.page);

  await cancelStaleUnpaidOrders().catch(() => 0);

  const conds: SQL[] = [];
  if (q) {
    const text = `%${q.replace(/[%_]/g, "")}%`;
    const digits = toLatinDigits(q).replace(/\D/g, "").replace(/^(00966|966|0)/, "");
    const parts: SQL[] = [ilike(orders.number, text), ilike(orders.customerName, text)];
    if (digits.length >= 3) parts.push(ilike(orders.customerPhone, `%${digits}%`));
    conds.push(or(...parts)!);
  }
  if (STATUSES.includes(status as OrderStatus)) conds.push(eq(orders.status, status as OrderStatus));
  if (PAYMENTS.includes(payment as PaymentStatus)) conds.push(eq(orders.paymentStatus, payment as PaymentStatus));
  const where = conds.length ? and(...conds) : undefined;

  const [rows, total] = await Promise.all([
    db
      .select()
      .from(orders)
      .where(where)
      .orderBy(desc(orders.createdAt), desc(orders.id))
      .limit(PER_PAGE)
      .offset((page - 1) * PER_PAGE),
    db.select({ c: dsql<number>`count(*)::int` }).from(orders).where(where),
  ]);
  const count = total[0]?.c ?? 0;

  return (
    <>
      <PageHeader title="الطلبات" subtitle={`${count.toLocaleString("en-US")} طلب`} />

      <Card className="mb-4">
        <form method="get" className="grid gap-3 md:grid-cols-[1fr_180px_180px_auto]">
          <Input name="q" defaultValue={q} placeholder="بحث برقم الطلب، الجوال أو الاسم" aria-label="بحث" />
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
          <div className="flex gap-2">
            <button type="submit" className={btnCls("dark")}>
              تصفية
            </button>
            {q || status || payment ? <LinkButton href="/admin/orders">مسح</LinkButton> : null}
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
                <Th>التاريخ</Th>
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
                  <Td className="whitespace-nowrap text-ink-mute">{fmtDateTime(o.createdAt)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState>{q || status || payment ? "لا توجد طلبات مطابقة للتصفية." : "لا توجد طلبات بعد."}</EmptyState>
        )}
        <Pagination page={page} totalPages={Math.ceil(count / PER_PAGE)} basePath="/admin/orders" params={{ q, status, payment }} />
      </Card>
    </>
  );
}
