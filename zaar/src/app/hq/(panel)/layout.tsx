import { eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { claims, payouts } from "@/db/schema";
import { Shell, type NavItem } from "@/components/dash/Shell";
import { endSession, requireHq } from "@/lib/auth";

export const metadata = { title: { default: "إدارة زار", template: "%s — إدارة زار" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

async function logout() {
  "use server";
  await endSession("hq");
  redirect("/hq/login");
}

export default async function HqLayout({ children }: { children: React.ReactNode }) {
  const email = await requireHq();

  const [[pendingPayouts], [needDecision], [manualRefunds]] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(payouts)
      .where(eq(payouts.status, "pending")),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(claims)
      .where(eq(claims.status, "merchant_replied")),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(claims)
      .where(eq(claims.refundState, "manual_pending")),
  ]);

  const nav: NavItem[] = [
    { href: "/hq", label: "نظرة عامة", icon: "home" },
    { href: "/hq/stores", label: "المتاجر", icon: "stores" },
    { href: "/hq/payouts", label: "التحويلات اليومية", icon: "payouts", badge: pendingPayouts.n },
    { href: "/hq/claims", label: "ضمان زار", icon: "claims", badge: needDecision.n + manualRefunds.n },
    { href: "/hq/orders", label: "الطلبات", icon: "orders" },
    { href: "/hq/settings", label: "الإعدادات", icon: "settings" },
  ];

  return (
    <Shell nav={nav} brand="إدارة زار" sub={email} logoutAction={logout}>
      {children}
    </Shell>
  );
}
