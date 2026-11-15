import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { confirmMoyasarPayment } from "@/lib/moyasar-orders";
import { moyasarKeysPresent } from "@/lib/settings";
import { PaymentWait } from "./PaymentWait";

export const metadata: Metadata = { title: "تأكيد الدفع", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * صفحة العودة من بوابة الدفع.
 * - ميسر: يعيد العميل ومعه ?id=<رقم العملية>، فنتحقق منها فورًا من الـ API بالمفتاح السري.
 * - EdfaPay: الحالة النهائية تأتي من الـ webhook، فننتظرها هنا لثوانٍ.
 */
export default async function ReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ o?: string; t?: string; s?: string; id?: string }>;
}) {
  const { o, t, s, id } = await searchParams;
  if (!o || !t) redirect("/");
  const rows = await db
    .select()
    .from(orders)
    .where(and(eq(orders.number, o.toUpperCase()), eq(orders.accessToken, t)))
    .limit(1);
  const order = rows[0];
  if (!order) redirect("/");
  const done = `/order/${order.number}?t=${order.accessToken}&new=1`;
  if (order.paymentStatus === "paid") redirect(done);

  let failed = s === "failed";
  if (order.paymentMethod === "moyasar" && id && order.status !== "cancelled" && moyasarKeysPresent()) {
    const outcome = await confirmMoyasarPayment(order, id).catch((e) => {
      console.error("[moyasar] return verification failed", e);
      return "pending" as const;
    });
    if (outcome === "paid") redirect(done);
    failed = outcome === "failed";
  }

  return (
    <div className="wrap grid min-h-[100svh] place-items-center pb-20 pt-[calc(var(--header-h)+2rem)]">
      <PaymentWait number={order.number} token={order.accessToken} failedHint={failed} />
    </div>
  );
}
