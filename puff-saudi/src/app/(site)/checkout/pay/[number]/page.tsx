import type { Metadata } from "next";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orders } from "@/db/schema";
import { formatAmount } from "@/lib/money";
import { moyasarDescription, moyasarPublishableKey } from "@/lib/moyasar";
import { getSettings, moyasarKeysPresent, siteUrl } from "@/lib/settings";
import { TLink } from "@/components/site/Transition";
import { SplitText } from "@/components/ui/Reveal";
import { MoyasarForm } from "./MoyasarForm";

export const metadata: Metadata = { title: "الدفع", robots: { index: false } };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ number: string }>; searchParams: Promise<{ t?: string }> };

/** صفحة الدفع داخل الموقع (ميسر): الطلب محفوظ مسبقًا، والمبلغ يُقفل على الخادم لحظة الضغط على «ادفع» */
export default async function PayPage({ params, searchParams }: Props) {
  const [{ number }, { t }] = await Promise.all([params, searchParams]);
  if (!t) notFound();
  const rows = await db
    .select()
    .from(orders)
    .where(and(eq(orders.number, number.toUpperCase()), eq(orders.accessToken, t)))
    .limit(1);
  const order = rows[0];
  if (!order) notFound();
  const orderUrl = `/order/${order.number}?t=${order.accessToken}`;
  if (order.paymentStatus === "paid") redirect(`${orderUrl}&new=1`);
  if (order.status === "cancelled" || order.paymentMethod !== "moyasar" || !moyasarKeysPresent()) redirect(orderUrl);

  const [settings, items] = await Promise.all([
    getSettings(),
    db.select().from(orderItems).where(eq(orderItems.orderId, order.id)),
  ]);
  const methods = ["creditcard", ...(settings.moyasarApplePay ? ["applepay"] : []), ...(settings.moyasarStcPay ? ["stcpay"] : [])];

  return (
    <div className="pb-24 pt-[calc(var(--header-h)+2rem)] md:pb-32 md:pt-[calc(var(--header-h)+4rem)]">
      <div className="wrap">
        <p className="t-eyebrow text-ink-mute">
          طلب رقم <span className="num text-ink">{order.number}</span>
        </p>
        <SplitText as="h1" className="t-h1 mt-3" text="الدفع." immediate />

        <div className="mt-8 grid gap-10 lg:grid-cols-[1.25fr_1fr] lg:gap-16">
          <section className="rounded-tile bg-paper-card p-5 md:p-8">
            <MoyasarForm
              number={order.number}
              token={order.accessToken}
              amount={order.total}
              description={moyasarDescription(order.number)}
              publishableKey={moyasarPublishableKey()}
              callbackUrl={`${siteUrl()}/checkout/return?o=${order.number}&t=${order.accessToken}`}
              methods={methods}
              storeName={settings.storeName}
            />
          </section>

          <aside className="h-fit rounded-tile border border-line p-6 md:p-8">
            <h2 className="t-h3 mb-5">ملخص الطلب</h2>
            <ul className="mb-5 space-y-3">
              {items.map((it) => (
                <li key={it.id} className="flex items-center gap-3">
                  <span className="relative h-14 w-12 shrink-0 overflow-hidden rounded-xl bg-paper-deep">
                    {it.imageUrl && <Image src={it.imageUrl} alt="" fill sizes="48px" className="object-cover" />}
                  </span>
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="line-clamp-1 font-medium">{it.name}</span>
                    <span className="block text-xs text-ink-mute">
                      {it.optionValue ? `${it.optionValue} · ` : ""}
                      <span className="num">{it.qty}</span> ×
                    </span>
                  </span>
                  <span className="num font-display text-sm font-bold">{formatAmount(it.total)}</span>
                </li>
              ))}
            </ul>
            <div className="space-y-2 border-t border-ink/15 pt-4 text-sm">
              {order.discount > 0 && (
                <div className="flex justify-between text-coral">
                  <span>الخصم</span>
                  <span className="num font-display font-bold">− {formatAmount(order.discount)} ر.س</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-ink-mute">الشحن — {order.shippingMethodName}</span>
                <span className="num font-display font-bold">{order.shipping === 0 ? "مجاني" : `${formatAmount(order.shipping)} ر.س`}</span>
              </div>
              <div className="flex items-baseline justify-between pt-2 font-display text-xl font-extrabold">
                <span>الإجمالي</span>
                <span>
                  <span className="num">{formatAmount(order.total)}</span> <span className="text-sm font-medium">ر.س</span>
                </span>
              </div>
            </div>
            <TLink href={orderUrl} className="link-draw mt-6 inline-block text-sm text-ink-mute">
              الدفع لاحقًا — عرض الطلب
            </TLink>
          </aside>
        </div>
      </div>
    </div>
  );
}
