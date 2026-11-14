import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { ArrowLeft, PartyPopper, Sparkles } from "lucide-react";
import { CopyButton } from "@/components/dash/client";
import { RevenueChart } from "@/components/dash/RevenueChart";
import { Badge, Card, Empty, Money, ORDER_TONE, PageHead, Stat, fmtDate } from "@/components/dash/ui";
import { Art } from "@/components/ui/Art";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { requireMerchantStore } from "@/lib/auth";
import { storeBalance } from "@/lib/ledger";
import { STATUS_LABEL } from "@/lib/orders";
import { getPlatform } from "@/lib/platform";
import { dashboardStats } from "@/lib/stats";
import { storePublicUrl } from "@/lib/stores";

export default async function DashboardHome({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const [{ merchant, store }, sp] = await Promise.all([requireMerchantStore(), searchParams]);
  const [stats, balance, cfg, recent] = await Promise.all([
    dashboardStats(store.id, 30),
    storeBalance(store.id),
    getPlatform(),
    db.select().from(orders).where(eq(orders.storeId, store.id)).orderBy(desc(orders.id)).limit(6),
  ]);
  const url = storePublicUrl(store.slug);
  const steps = [
    { done: true, label: "متجرك منشور ويستقبل الطلبات", href: url },
    { done: Boolean(store.iban), label: "أضف الآيبان لتستلم التحويل اليومي", href: "/dashboard/wallet" },
    { done: stats.ordersCount > 0 || Boolean(store.settings.whatsapp), label: "أضف واتساب وبيانات التواصل", href: "/dashboard/settings" },
    { done: false, label: "راجع المنتجات والأسعار وارفع صورك", href: "/dashboard/products" },
  ];
  const f = stats.funnel;
  const funnel = [
    { label: "زيارات", value: f.views },
    { label: "شاهدوا منتجًا", value: f.productViews },
    { label: "أضافوا للسلة", value: f.addToCart },
    { label: "بدأوا الدفع", value: f.checkouts },
    { label: "طلبات مدفوعة", value: f.orders },
  ];
  const top = Math.max(f.views, 1);

  return (
    <>
      {sp.welcome && (
        <section className="relative mb-6 overflow-hidden rounded-[2rem] bg-ink p-6 text-paper md:p-9">
          <span className="z-glow -left-16 -top-24 h-72 w-72" aria-hidden />
          <div className="relative">
            <PartyPopper size={30} className="text-accent" />
            <h2 className="mt-4 font-display text-2xl font-black md:text-4xl">مبروك يا {merchant.name.split(" ")[0]} — «{store.name}» انتشر!</h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-paper/65">متجرك الآن يستقبل الطلبات ويقبل الدفع. أرباحك تتحوّل لحسابك يوميًا، وكل طلب عند عملائك مضمون بضمان زار.</p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a href={url} target="_blank" rel="noopener" className="dash-btn dash-btn-accent">
                افتح متجري <ArrowLeft size={16} />
              </a>
              <span className="num rounded-full bg-paper/10 px-4 py-2.5 text-xs" dir="ltr">
                {url.replace(/^https?:\/\//, "")}
              </span>
              <span className="[&_button]:!border-paper/25 [&_button]:!text-paper">
                <CopyButton value={url} label="انسخ الرابط" />
              </span>
            </div>
          </div>
        </section>
      )}

      <PageHead title={`هلا ${merchant.name.split(" ")[0]}`} sub="هذي صورة متجرك اليوم.">
        <Link href="/dashboard/assistant" className="dash-btn dash-btn-ink">
          <Sparkles size={16} /> اسأل مساعد زار
        </Link>
      </PageHead>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat accent label="مبيعات اليوم" value={<Money value={stats.today.revenue} />} hint={`${stats.today.orders} طلب · ${stats.today.views} زيارة`} />
        <Stat label="تحويل الغد لحسابك" value={<Money value={balance.nextPayout} />} hint={store.iban ? "يُحوَّل تلقائيًا بعد منتصف الليل" : "أضف الآيبان لتستلمه"} />
        <Stat label="طلبات بانتظار التجهيز" value={stats.toFulfil} hint={stats.toFulfil ? "جهّزها واشحنها" : "ما فيه شي معلّق"} />
        <Stat label="مبيعات آخر 7 أيام" value={<Money value={stats.week.revenue} />} hint={`${stats.week.orders} طلب`} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.7fr_1fr]">
        <Card title="المبيعات — آخر 30 يومًا" action={<span className="text-xs text-ink/50">الصافي بعد عمولة زار: <Money value={stats.net} /></span>}>
          <p className="mb-5 font-display text-3xl font-black">
            <Money value={stats.revenue} />
            <span className="ms-3 text-sm font-medium text-ink/50">
              {stats.ordersCount} طلب · متوسط الطلب <Money value={stats.aov} />
            </span>
          </p>
          <RevenueChart points={stats.points} />
        </Card>

        <Card title="من الزيارة إلى الطلب" action={<Badge tone={stats.conversion >= 1 ? "good" : "neutral"}>تحويل {stats.conversion}%</Badge>}>
          <ul className="space-y-3">
            {funnel.map((x) => (
              <li key={x.label}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-ink/70">{x.label}</span>
                  <span className="num font-semibold">{x.value}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-ink/[0.07]">
                  <div className="h-full rounded-full bg-ink" style={{ width: `${Math.min(100, (x.value / top) * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs leading-relaxed text-ink/50">عمولة زار {cfg.feeBp / 100}% + {cfg.feeFixed / 100} ر.س لكل طلب مدفوع — بدون اشتراك شهري.</p>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.7fr_1fr]">
        <Card title="آخر الطلبات" action={<Link href="/dashboard/orders" className="text-xs font-semibold underline underline-offset-4">كل الطلبات</Link>}>
          {recent.length === 0 ? (
            <Empty title="ما وصلك طلب للحين" text="شارك رابط متجرك في حساباتك وأول طلب بيجيك هنا." action={<CopyButton value={url} label="انسخ رابط المتجر" />} />
          ) : (
            <ul className="divide-y divide-ink/[0.07]">
              {recent.map((o) => (
                <li key={o.id}>
                  <Link href={`/dashboard/orders/${o.id}`} className="flex items-center justify-between gap-3 py-3 transition-colors hover:bg-ink/[0.02]">
                    <span className="min-w-0">
                      <span className="num block text-sm font-semibold">{o.number}</span>
                      <span className="block truncate text-xs text-ink/55">
                        {o.customerName} · {o.city} · {fmtDate(o.createdAt, true)}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      <Badge tone={ORDER_TONE[o.status]}>{STATUS_LABEL[o.status]}</Badge>
                      <Money value={o.total} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-4">
          <Card title="خطواتك الجاية">
            <ul className="space-y-2.5">
              {steps.map((s) => (
                <li key={s.label}>
                  <a href={s.href} className="flex items-center gap-3 text-sm">
                    <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[0.65rem] font-bold ${s.done ? "bg-emerald-500 text-white" : "border-2 border-ink/20"}`}>{s.done ? "✓" : ""}</span>
                    <span className={s.done ? "text-ink/45 line-through" : "font-medium"}>{s.label}</span>
                  </a>
                </li>
              ))}
            </ul>
          </Card>
          {stats.top.length > 0 && (
            <Card title="الأكثر مبيعًا">
              <ul className="space-y-3">
                {stats.top.map((p) => (
                  <li key={p.id} className="flex items-center gap-3">
                    <span className="block h-11 w-10 shrink-0 overflow-hidden rounded-xl">
                      <Art image={p.image} art={p.art} alt="" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
                    <span className="num text-xs font-semibold text-ink/60">{p.sold} مبيعة</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
