import { notFound, redirect } from "next/navigation";
import { FlaskConical } from "lucide-react";
import { formatAmount } from "@/lib/money";
import { markOrderPaid, markPaymentFailed, storeOfOrder } from "@/lib/orders";
import { testPaymentsEnabled } from "@/lib/payments";
import { orderByRef } from "@/lib/payments/settle";
import { storePublicUrl } from "@/lib/stores";

export const metadata = { title: "بوابة الدفع التجريبية", robots: { index: false } };
export const dynamic = "force-dynamic";

async function load(ref: string) {
  if (!testPaymentsEnabled()) return null;
  const order = await orderByRef(ref);
  return order && order.gateway === "test" ? order : null;
}

async function decide(form: FormData) {
  "use server";
  const order = await load(String(form.get("ref") ?? ""));
  if (!order) notFound();
  if (order.status === "pending_payment") {
    if (form.get("outcome") === "approve") await markOrderPaid(order.id, `TEST-${order.paymentRef}`);
    else await markPaymentFailed(order.id, "رُفضت العملية في البوابة التجريبية");
  }
  const store = await storeOfOrder(order);
  redirect(`${storePublicUrl(store.slug)}/order/${order.number}?t=${order.token}`);
}

/** بوابة دفع تجريبية داخلية — تعمل فقط عند تفعيل ZAAR_TEST_PAYMENTS لتجربة الدورة كاملة بلا مفاتيح حقيقية */
export default async function TestPayPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const order = await load(decodeURIComponent(ref));
  if (!order) notFound();
  const store = await storeOfOrder(order);
  const method = { card: "بطاقة", tabby: "تابي", tamara: "تمارا", cod: "" }[order.paymentMethod];

  return (
    <main className="grid min-h-screen place-items-center bg-ink p-5 text-paper">
      <div className="w-full max-w-md rounded-[2rem] bg-paper p-7 text-ink">
        <p className="flex items-center gap-2 text-xs font-semibold text-amber-700">
          <FlaskConical size={15} /> بوابة دفع تجريبية — لا يُخصم أي مبلغ حقيقي
        </p>
        <h1 className="mt-4 font-display text-2xl font-black">الدفع عبر {method}</h1>
        <p className="mt-1 text-sm text-ink/60">
          {store.name} — طلب <span className="num">{order.number}</span>
        </p>
        <p className="mt-6 font-display text-5xl font-black">
          <span className="num">{formatAmount(order.total)}</span> <span className="text-lg font-semibold">ر.س</span>
        </p>
        <form action={decide} className="mt-8 grid gap-3">
          <input type="hidden" name="ref" value={order.paymentRef ?? ""} />
          <button name="outcome" value="approve" className="btn btn-ink w-full !min-h-[3.6rem] !text-base">
            ادفع (عملية ناجحة)
          </button>
          <button name="outcome" value="decline" className="btn btn-ghost w-full">
            ارفض العملية
          </button>
        </form>
      </div>
    </main>
  );
}
