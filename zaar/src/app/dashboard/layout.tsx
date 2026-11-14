import { and, eq, inArray, sql } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { claims, orders } from "@/db/schema";
import { Shell, type NavItem } from "@/components/dash/Shell";
import { endSession, requireMerchantStore } from "@/lib/auth";
import { storePublicUrl } from "@/lib/stores";

export const metadata = { title: "لوحة التحكم", robots: { index: false } };
export const dynamic = "force-dynamic";

async function logout() {
  "use server";
  await endSession("merchant");
  redirect("/");
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { merchant, store } = await requireMerchantStore();
  const [[toFulfil], [openClaims]] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(orders)
      .where(and(eq(orders.storeId, store.id), inArray(orders.status, ["paid", "processing"]))),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(claims)
      .where(and(eq(claims.storeId, store.id), eq(claims.status, "open"))),
  ]);

  const nav: NavItem[] = [
    { href: "/dashboard", label: "الرئيسية", icon: "home" },
    { href: "/dashboard/orders", label: "الطلبات", icon: "orders", badge: toFulfil.n },
    { href: "/dashboard/products", label: "المنتجات", icon: "products" },
    { href: "/dashboard/wallet", label: "المحفظة والتحويل اليومي", icon: "wallet" },
    { href: "/dashboard/claims", label: "ضمان زار", icon: "claims", badge: openClaims.n },
    { href: "/dashboard/coupons", label: "الكوبونات", icon: "coupons" },
    { href: "/dashboard/customers", label: "العملاء", icon: "customers" },
    { href: "/dashboard/carts", label: "السلال المتروكة", icon: "carts" },
    { href: "/dashboard/reviews", label: "التقييمات", icon: "reviews" },
    { href: "/dashboard/design", label: "التصميم", icon: "design" },
    { href: "/dashboard/assistant", label: "مساعد زار", icon: "assistant" },
    { href: "/dashboard/settings", label: "الإعدادات", icon: "settings" },
  ];

  return (
    <Shell nav={nav} brand={store.name} sub={merchant.name} storeUrl={storePublicUrl(store.slug)} logoutAction={logout}>
      {!store.iban && (
        <Link
          href="/dashboard/wallet"
          className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-accent px-5 py-4 text-sm font-medium text-on-accent transition-transform hover:-translate-y-0.5"
        >
          <span>أضف رقم الآيبان عشان تبدأ تستلم أرباحك بالتحويل اليومي.</span>
          <span className="font-display text-xs font-bold underline underline-offset-4">أضف الآيبان</span>
        </Link>
      )}
      {store.status === "suspended" && (
        <p className="mb-6 rounded-3xl bg-red-500/10 px-5 py-4 text-sm font-medium text-red-700">متجرك موقوف مؤقتًا من إدارة زار. تواصل مع الدعم لمعرفة السبب.</p>
      )}
      {children}
    </Shell>
  );
}
