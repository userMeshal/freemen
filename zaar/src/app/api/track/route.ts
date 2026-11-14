import { NextResponse } from "next/server";
import { bump } from "@/lib/stats";
import { getStoreBySlug } from "@/lib/stores";

export const runtime = "nodejs";
const EVENTS = new Set(["views", "productViews", "addToCart"]);

/** عدّادات التحليلات المجمّعة للمتجر (لا تُخزَّن أي بيانات عن الزائر) */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { slug?: string; event?: string } | null;
  if (!body || typeof body.slug !== "string" || !EVENTS.has(String(body.event)) || !/^[a-z0-9-]{3,40}$/.test(body.slug)) {
    return new NextResponse(null, { status: 204 });
  }
  const store = await getStoreBySlug(body.slug);
  if (store?.status === "live") await bump(store.id, body.event as "views" | "productViews" | "addToCart");
  return new NextResponse(null, { status: 204 });
}
