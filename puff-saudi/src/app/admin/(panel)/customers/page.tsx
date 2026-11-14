import Link from "next/link";
import { desc, eq, ilike, or, sql as dsql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { customers, orders } from "@/db/schema";
import { formatSar } from "@/lib/money";
import { displayPhone, toLatinDigits } from "@/lib/normalize";
import { fmtDate, one, pageNumber } from "@/lib/admin-utils";
import { Badge, Card, EmptyState, Input, LinkButton, PageHeader, Pagination, Table, Td, Th, btnCls } from "@/components/admin/ui";

export const metadata = { title: "العملاء" };

const PER_PAGE = 20;

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = one(sp.q);
  const page = pageNumber(sp.page);

  let where: SQL | undefined;
  if (q) {
    const text = `%${q.replace(/[%_]/g, "")}%`;
    const digits = toLatinDigits(q).replace(/\D/g, "").replace(/^(00966|966|0)/, "");
    const parts: SQL[] = [ilike(customers.name, text), ilike(customers.email, text)];
    if (digits.length >= 3) parts.push(ilike(customers.phone, `%${digits}%`));
    where = or(...parts);
  }

  const [rows, total] = await Promise.all([
    db
      .select({
        id: customers.id,
        name: customers.name,
        phone: customers.phone,
        email: customers.email,
        registered: dsql<boolean>`${customers.passwordHash} is not null`,
        createdAt: customers.createdAt,
        ordersCount: dsql<number>`count(${orders.id}) filter (where ${orders.status} <> 'cancelled')::int`,
        spent: dsql<string>`coalesce(sum(${orders.total}) filter (where ${orders.status} <> 'cancelled' and (${orders.paymentStatus} = 'paid' or (${orders.paymentMethod} = 'cod' and ${orders.paymentStatus} <> 'refunded'))), 0)::bigint`,
      })
      .from(customers)
      .leftJoin(orders, eq(orders.customerId, customers.id))
      .where(where)
      .groupBy(customers.id)
      .orderBy(desc(customers.createdAt), desc(customers.id))
      .limit(PER_PAGE)
      .offset((page - 1) * PER_PAGE),
    db.select({ c: dsql<number>`count(*)::int` }).from(customers).where(where),
  ]);
  const count = total[0]?.c ?? 0;

  return (
    <>
      <PageHeader title="العملاء" subtitle={`${count.toLocaleString("en-US")} عميل`} />

      <Card className="mb-4">
        <form method="get" className="flex flex-wrap gap-3">
          <Input name="q" defaultValue={q} placeholder="بحث بالاسم، الجوال أو البريد" aria-label="بحث" className="max-w-md" />
          <button type="submit" className={btnCls("dark")}>
            بحث
          </button>
          {q ? <LinkButton href="/admin/customers">مسح</LinkButton> : null}
        </form>
      </Card>

      <Card padded={false}>
        {rows.length ? (
          <Table>
            <thead>
              <tr>
                <Th>الاسم</Th>
                <Th>الجوال</Th>
                <Th>البريد</Th>
                <Th>الطلبات</Th>
                <Th>إجمالي المشتريات</Th>
                <Th>النوع</Th>
                <Th>منذ</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="hover:bg-paper-card">
                  <Td>
                    <Link href={`/admin/customers/${c.id}`} className="font-semibold hover:underline">
                      {c.name}
                    </Link>
                  </Td>
                  <Td>
                    <span dir="ltr">{displayPhone(c.phone)}</span>
                  </Td>
                  <Td>
                    {c.email ? (
                      <span dir="ltr" className="text-ink-mute">
                        {c.email}
                      </span>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td>{c.ordersCount}</Td>
                  <Td className="whitespace-nowrap font-semibold">{formatSar(Number(c.spent))}</Td>
                  <Td>
                    <Badge tone={c.registered ? "blue" : "neutral"}>{c.registered ? "مسجّل" : "ضيف"}</Badge>
                  </Td>
                  <Td className="whitespace-nowrap text-ink-mute">{fmtDate(c.createdAt)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState>{q ? "لا يوجد عملاء مطابقون." : "لا يوجد عملاء بعد — يُضافون تلقائيًا مع أول طلب أو تسجيل."}</EmptyState>
        )}
        <Pagination page={page} totalPages={Math.ceil(count / PER_PAGE)} basePath="/admin/customers" params={{ q }} />
      </Card>
    </>
  );
}
