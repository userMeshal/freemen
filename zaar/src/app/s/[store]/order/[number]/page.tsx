import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { OrderView } from "@/components/store/OrderView";
import { db } from "@/db";
import { reviews } from "@/db/schema";
import { CLAIM_REASONS, claimEligibility, guaranteeEndsAt } from "@/lib/claims";
import { getOrderForTracking, STATUS_LABEL } from "@/lib/orders";
import { paymentOptions } from "@/lib/payments";
import { getPlatform } from "@/lib/platform";
import { getStoreBySlug } from "@/lib/stores";

export const metadata = { title: "طلبك", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function OrderPage({ params, searchParams }: { params: Promise<{ store: string; number: string }>; searchParams: Promise<{ t?: string }> }) {
  const [{ store: slug, number }, sp] = await Promise.all([params, searchParams]);
  const store = await getStoreBySlug(slug);
  if (!store || !sp.t) notFound();
  const data = await getOrderForTracking(store.id, number, sp.t);
  if (!data) notFound();
  const { order, items, claim } = data;
  const [cfg, reviewed] = await Promise.all([
    getPlatform(),
    db.select({ productId: reviews.productId }).from(reviews).where(eq(reviews.orderId, order.id)),
  ]);
  const el = claimEligibility(order, claim, cfg);
  const ends = guaranteeEndsAt(order, cfg);

  return (
    <OrderView
      order={{
        number: order.number,
        token: order.token,
        status: order.status,
        statusLabel: STATUS_LABEL[order.status],
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        customerName: order.customerName,
        city: order.city,
        address: order.address,
        subtotal: order.subtotal,
        discount: order.discount,
        shipping: order.shipping,
        total: order.total,
        vat: order.vat,
        shippingCompany: order.shippingCompany,
        trackingNumber: order.trackingNumber,
        createdAt: order.createdAt.toISOString(),
        events: order.events.filter((e) => e.type !== "payment_failed"),
      }}
      items={items.map((i) => ({ id: i.id, productId: i.productId, name: i.name, optionValue: i.optionValue, unitPrice: i.unitPrice, qty: i.qty, image: i.image, art: i.art ?? { hue: 200, icon: "Package" } }))}
      claim={claim ? { status: claim.status, reason: CLAIM_REASONS[claim.reason] ?? claim.reason, resolution: claim.resolution, merchantReply: claim.merchantReply, refundState: claim.refundState } : null}
      canClaim={el.ok}
      claimBlocked={el.ok ? "" : el.reason}
      guaranteeEnds={ends ? ends.toISOString() : null}
      claimReasons={CLAIM_REASONS}
      reviewed={reviewed.map((r) => r.productId)}
      payments={paymentOptions()}
      guaranteeDays={cfg.guaranteeDays}
      replyHours={cfg.claimReplyHours}
    />
  );
}
