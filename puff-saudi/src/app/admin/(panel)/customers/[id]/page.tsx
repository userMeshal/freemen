import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { ArrowRight } from "lucide-react";
import { db } from "@/db";
import { customers, orders } from "@/db/schema";
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/orders";
import { formatSar } from "@/lib/money";
import { displayPhone } from "@/lib/normalize";
import { fmtDate, fmtDateTime, ORDER_STATUS_TONE, PAYMENT_STATUS_TONE } from "@/lib/admin-utils";
import { Badge, Card, DefList, EmptyState, PageHeader, Stat, Table, Td, Textarea, Th } from "@/components/admin/ui";
import { ActionForm, SubmitButton } from "@/components/admin/client";
import { saveCustomerNotesAction } from "../actions";

export const metadata = { title: "تفاصيل العميل" };

export default async function AdminCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const rows = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  const c = rows[0];
  if (!c) notFound();

  const list = await db.select().from(orders).where(eq(orders.customerId, id)).orderBy(desc(orders.createdAt)).limit(200);
  const valid = list.filter((o) => o.status !== "cancelled");
  const spent = valid
    .filter((o) => o.paymentStatus === "paid" || (o.paymentMethod === "cod" && o.paymentStatus !== "refunded"))
    .reduce((s, o) => s + o.total, 0);

  return (
    <>
      <Link href="/admin/customers" className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-ink-mute hover:text-ink">
        <ArrowRight className="h-3.5 w-3.5" /> كل العملاء
      </Link>
      <PageHeader title={c.name} subtitle={`عميل منذ ${fmtDate(c.createdAt)}`}>
        <Badge tone={c.passwordHash ? "blue" : "neutral"}>{c.passwordHash ? "حساب مسجّل" : "ضيف"}</Badge>
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat label="عدد الطلبات" value={valid.length} hint="غير الملغاة" />
        <Stat label="إجمالي المشتريات" value={formatSar(spent)} />
        <Stat label="متوسط الطلب" value={formatSar(valid.length ? Math.round(valid.reduce((s, o) => s + o.total, 0) / valid.length) : 0)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="الطلبات" padded={false} className="xl:col-span-2">
          {list.length ? (
            <Table>
              <thead>
                <tr>
                  <Th>رقم الطلب</Th>
                  <Th>الإجمالي</Th>
                  <Th>الحالة</Th>
                  <Th>الدفع</Th>
                  <Th>التاريخ</Th>
                </tr>
              </thead>
              <tbody>
                {list.map((o) => (
                  <tr key={o.id} className="hover:bg-paper-card">
                    <Td>
                      <Link href={`/admin/orders/${o.id}`} className="font-bold hover:underline" dir="ltr">
                        {o.number}
                      </Link>
                    </Td>
                    <Td className="whitespace-nowrap font-semibold">{formatSar(o.total)}</Td>
                    <Td>
                      <Badge tone={ORDER_STATUS_TONE[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Badge>
                    </Td>
                    <Td>
                      <Badge tone={PAYMENT_STATUS_TONE[o.paymentStatus]}>{PAYMENT_STATUS_LABEL[o.paymentStatus]}</Badge>
                    </Td>
                    <Td className="whitespace-nowrap text-ink-mute">{fmtDateTime(o.createdAt)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <EmptyState>لا توجد طلبات لهذا العميل.</EmptyState>
          )}
        </Card>

        <div className="space-y-6">
          <Card title="بيانات التواصل">
            <DefList
              items={[
                [
                  "الجوال",
                  <a key="p" href={`tel:+${c.phone}`} dir="ltr" className="underline">
                    {displayPhone(c.phone)}
                  </a>,
                ],
                [
                  "البريد",
                  c.email ? (
                    <a key="e" href={`mailto:${c.email}`} dir="ltr" className="break-all underline">
                      {c.email}
                    </a>
                  ) : (
                    "—"
                  ),
                ],
                ["المدينة", c.address?.city ?? "—"],
                ["العنوان المختصر", c.address?.shortAddress ?? "—"],
                ["تفاصيل العنوان", [c.address?.district, c.address?.street].filter(Boolean).join("، ") || "—"],
              ]}
            />
          </Card>
          <Card title="ملاحظات إدارية (داخلية)">
            <ActionForm action={saveCustomerNotesAction} className="space-y-3">
              <input type="hidden" name="id" value={c.id} />
              <Textarea name="notes" rows={4} defaultValue={c.notes ?? ""} maxLength={2000} aria-label="ملاحظات" />
              <SubmitButton variant="outline" size="sm">
                حفظ
              </SubmitButton>
            </ActionForm>
          </Card>
        </div>
      </div>
    </>
  );
}
