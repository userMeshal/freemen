import "server-only";
import { after } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orders } from "@/db/schema";
import { sourceText } from "@/lib/attribution";
import { formatSar } from "@/lib/money";
import { sendPush } from "@/lib/push";
import { sendTelegramOrder } from "@/lib/telegram";

/**
 * إشعار التاجر بطلب مؤكَّد: يُستدعى عند تأكيد الدفع الإلكتروني أو إنشاء طلب دفع عند الاستلام.
 * يرسل لكل القنوات المفعّلة (إشعارات الجوال المباشرة + تيليجرام). لا يرمي أخطاء.
 */
export async function notifyNewOrder(orderId: number): Promise<void> {
  try {
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) return;
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    const city = (order.address as { city?: string } | null)?.city;
    const results = await Promise.allSettled([
      sendPush({
        title: `طلب جديد ${order.number} — ${formatSar(order.total)}`,
        body: [
          order.paymentMethod === "cod" ? "الدفع عند الاستلام" : "مدفوع إلكترونيًا",
          order.customerName,
          city,
          order.attribution ? `من ${sourceText(order.attribution, true)}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        url: `/admin/orders/${order.id}`,
        tag: `order-${order.id}`,
      }),
      sendTelegramOrder(order, items),
    ]);
    for (const r of results) if (r.status === "rejected") console.error("[notify] channel failed", r.reason);
  } catch (e) {
    console.error("[notify] order notification failed", e);
  }
}

/** يرسل الإشعار بعد انتهاء الرد على العميل حتى لا يتأخر عليه شيء */
export function queueOrderNotification(orderId: number) {
  try {
    after(() => notifyNewOrder(orderId));
  } catch {
    void notifyNewOrder(orderId);
  }
}
