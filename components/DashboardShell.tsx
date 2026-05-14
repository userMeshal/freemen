import Link from "next/link";

const links = [
  { href: "/dashboard", label: "الرئيسية" },
  { href: "/products", label: "المنتجات" },
  { href: "/orders", label: "الطلبات" },
  { href: "/customers", label: "العملاء" },
  { href: "/coupons", label: "الكوبونات" },
  { href: "/shipping", label: "الشحن" },
  { href: "/payments", label: "المدفوعات" },
  { href: "/wallet", label: "المحفظة والتحويلات" },
  { href: "/design", label: "تصميم المتجر" },
  { href: "/pages", label: "الصفحات والسياسات" },
  { href: "/analytics", label: "التقارير" },
  { href: "/apps", label: "التطبيقات" },
  { href: "/settings", label: "الإعدادات" },
  { href: "/admin", label: "إدارة فريمان" }
];

export default function DashboardShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <main className="wrap">
      <section>
        <div className="dash-title">
          <div>
            <span className="badge">Freemen OS</span>
            <h1>{title}</h1>
            {subtitle && <p className="lead">{subtitle}</p>}
          </div>
          <Link className="btn secondary" href="/store/swan">عرض المتجر</Link>
        </div>
        <div className="dashboard pro-dashboard">
          <aside className="side">{links.map((l) => <Link key={l.href} href={l.href}>{l.label}</Link>)}</aside>
          <div className="dash-main">{children}</div>
        </div>
      </section>
    </main>
  );
}
