import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { PaymentWait } from "./PaymentWait";

export const metadata: Metadata = { title: "تأكيد الدفع", robots: { index: false } };
export const dynamic = "force-dynamic";

/** صفحة العودة من بوابة الدفع: الحالة النهائية تأتي من الـ webhook، فننتظرها هنا لثوانٍ */
export default async function ReturnPage({ searchParams }: { searchParams: Promise<{ o?: string; t?: string; s?: string }> }) {
  const { o, t, s } = await searchParams;
  if (!o || !t) redirect("/");
  const rows = await db
    .select({ number: orders.number, token: orders.accessToken, paymentStatus: orders.paymentStatus })
    .from(orders)
    .where(and(eq(orders.number, o.toUpperCase()), eq(orders.accessToken, t)))
    .limit(1);
  const order = rows[0];
  if (!order) redirect("/");
  if (order.paymentStatus === "paid") redirect(`/order/${order.number}?t=${order.token}&new=1`);

  return (
    <div className="wrap grid min-h-[100svh] place-items-center pb-20 pt-[calc(var(--header-h)+2rem)]">
      <PaymentWait number={order.number} token={order.token} failedHint={s === "failed"} />
    </div>
  );
}
