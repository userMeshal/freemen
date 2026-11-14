import "server-only";
import { and, desc, eq, gte, inArray, sql as dsql } from "drizzle-orm";
import { db } from "@/db";
import { dailyStats, orders, products } from "@/db/schema";
import { riyadhDay } from "./platform";

type Counter = "views" | "productViews" | "addToCart" | "checkouts";
const COL: Record<Counter, string> = { views: "views", productViews: "product_views", addToCart: "add_to_cart", checkouts: "checkouts" };

/** عدّاد يومي مجمّع — لا يخزّن أي شيء عن الزائر نفسه */
export async function bump(storeId: number, counter: Counter) {
  const col = dsql.raw(COL[counter]);
  await db
    .execute(
      dsql`insert into daily_stats (store_id, day, ${col}) values (${storeId}, ${riyadhDay()}, 1)
           on conflict (store_id, day) do update set ${col} = daily_stats.${col} + 1`,
    )
    .catch(() => {});
}

const PAID: ("paid" | "processing" | "shipped" | "delivered")[] = ["paid", "processing", "shipped", "delivered"];

export async function dashboardStats(storeId: number, days = 30) {
  const since = new Date(Date.now() - days * 24 * 3600 * 1000);
  const sinceDay = riyadhDay(since);
  const today = riyadhDay();
  const dayExpr = dsql<string>`to_char(${orders.paidAt} at time zone 'Asia/Riyadh', 'YYYY-MM-DD')`;

  const [series, traffic, top, pending] = await Promise.all([
    db
      .select({ day: dayExpr, revenue: dsql<number>`sum(${orders.total})::int`, net: dsql<number>`sum(${orders.net})::int`, count: dsql<number>`count(*)::int` })
      .from(orders)
      .where(and(eq(orders.storeId, storeId), inArray(orders.status, PAID), gte(orders.paidAt, since)))
      .groupBy(dayExpr),
    db
      .select()
      .from(dailyStats)
      .where(and(eq(dailyStats.storeId, storeId), gte(dailyStats.day, sinceDay))),
    db
      .select({ id: products.id, name: products.name, sold: products.sold, price: products.price, art: products.art, image: dsql<string | null>`${products.images}->>0` })
      .from(products)
      .where(eq(products.storeId, storeId))
      .orderBy(desc(products.sold))
      .limit(5),
    db
      .select({ status: orders.status, count: dsql<number>`count(*)::int` })
      .from(orders)
      .where(eq(orders.storeId, storeId))
      .groupBy(orders.status),
  ]);

  const byDay = new Map(series.map((s) => [s.day, s]));
  const trafficByDay = new Map(traffic.map((t) => [t.day, t]));
  const points: { day: string; revenue: number; orders: number; views: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = riyadhDay(new Date(Date.now() - i * 24 * 3600 * 1000));
    points.push({ day: d, revenue: byDay.get(d)?.revenue ?? 0, orders: byDay.get(d)?.count ?? 0, views: trafficByDay.get(d)?.views ?? 0 });
  }
  const sum = (f: (p: (typeof points)[number]) => number, from = 0) => points.slice(from).reduce((s, p) => s + f(p), 0);
  const revenue = sum((p) => p.revenue);
  const ordersCount = sum((p) => p.orders);
  const views = traffic.reduce((s, t) => s + t.views, 0);
  const funnel = {
    views,
    productViews: traffic.reduce((s, t) => s + t.productViews, 0),
    addToCart: traffic.reduce((s, t) => s + t.addToCart, 0),
    checkouts: traffic.reduce((s, t) => s + t.checkouts, 0),
    orders: ordersCount,
  };
  const status = Object.fromEntries(pending.map((p) => [p.status, p.count])) as Record<string, number>;
  return {
    points,
    today: { revenue: byDay.get(today)?.revenue ?? 0, orders: byDay.get(today)?.count ?? 0, views: trafficByDay.get(today)?.views ?? 0 },
    week: { revenue: sum((p) => p.revenue, days - 7), orders: sum((p) => p.orders, days - 7) },
    revenue,
    net: series.reduce((s, x) => s + x.net, 0),
    ordersCount,
    aov: ordersCount ? Math.round(revenue / ordersCount) : 0,
    conversion: views ? Math.round((ordersCount / views) * 1000) / 10 : 0,
    funnel,
    top: top.filter((t) => t.sold > 0),
    toFulfil: (status.paid ?? 0) + (status.processing ?? 0),
    status,
  };
}
