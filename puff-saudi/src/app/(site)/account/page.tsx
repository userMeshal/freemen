import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { getCustomer } from "@/lib/auth";
import { formatAmount } from "@/lib/money";
import { displayPhone } from "@/lib/normalize";
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/orders";
import { PageHero } from "@/components/site/PageHero";
import { TLink } from "@/components/site/Transition";
import { ProfileForm } from "./AuthForms";
import { logoutAction } from "./actions";

export const metadata: Metadata = { title: "حسابي", robots: { index: false } };
export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", { dateStyle: "medium", timeZone: "Asia/Riyadh" });

export default async function AccountPage() {
  const customer = await getCustomer();
  if (!customer || !customer.passwordHash) redirect("/account/login");

  const list = await db
    .select()
    .from(orders)
    .where(and(eq(orders.customerId, customer.id), gte(orders.createdAt, customer.registeredAt ?? customer.createdAt)))
    .orderBy(desc(orders.createdAt))
    .limit(50);

  return (
    <>
      <PageHero eyebrow="Account" title={`أهلًا،\n${customer.name.split(" ")[0]}.`} crumbs={[{ label: "حسابي" }]} />
      <div className="wrap grid gap-12 pb-24 md:pb-32 lg:grid-cols-[1.6fr_1fr] lg:gap-16">
        <section>
          <h2 className="t-h3 mb-5">طلباتي</h2>
          {list.length === 0 ? (
            <div className="rounded-tile bg-paper-card p-10 text-center">
              <p className="font-display text-lg font-bold">لا توجد طلبات بعد</p>
              <TLink href="/shop" className="btn btn-ink mt-5">
                تصفّح المتجر
              </TLink>
            </div>
          ) : (
            <ul className="divide-y divide-line border-y border-line">
              {list.map((o) => (
                <li key={o.id}>
                  <TLink href={`/order/${o.number}`} className="group flex flex-wrap items-center justify-between gap-3 py-5">
                    <span>
                      <span className="num block font-display text-lg font-bold">{o.number}</span>
                      <span className="num text-sm text-ink-mute">{dateFmt.format(o.createdAt)}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="rounded-full bg-ink px-3 py-1 text-xs font-semibold text-paper">{ORDER_STATUS_LABEL[o.status]}</span>
                      <span className="rounded-full border border-ink/20 px-3 py-1 text-xs">{PAYMENT_STATUS_LABEL[o.paymentStatus]}</span>
                    </span>
                    <span className="font-display font-bold">
                      <span className="num">{formatAmount(o.total)}</span> <span className="text-xs font-medium">ر.س</span>
                    </span>
                  </TLink>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="h-fit rounded-tile bg-paper-card p-6 md:p-8">
          <h2 className="t-h3 mb-1">بياناتي</h2>
          <p className="mb-5 text-sm text-ink-mute" dir="ltr" style={{ textAlign: "start" }}>
            {customer.email} · {displayPhone(customer.phone)}
          </p>
          <ProfileForm name={customer.name} />
          <form action={logoutAction} className="mt-6 border-t border-ink/15 pt-5">
            <button className="link-draw text-sm font-semibold text-coral">تسجيل الخروج</button>
          </form>
        </aside>
      </div>
    </>
  );
}
