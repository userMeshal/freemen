import DashboardShell from "@/components/DashboardShell";

export default function WalletPage() {
  return (
    <DashboardShell title="المحفظة والتحويلات" subtitle="تابع رصيد التاجر والتحويلات القادمة والمعلقة.">
      <div className="kpi-grid">
        <div className="kpi"><span>رصيد قابل للتحويل</span><b>920 ر.س</b></div>
        <div className="kpi"><span>رصيد معلق</span><b>348 ر.س</b></div>
        <div className="kpi"><span>رسوم فريمان</span><b>18 ر.س</b></div>
        <div className="kpi"><span>موعد التحويل</span><b>اليوم</b></div>
      </div>
      <div className="panel">
        <h2>سياسة التحويل</h2>
        <div className="metric-line"><span>Free</span><b>بعد 7 أيام</b></div>
        <div className="metric-line"><span>Pro</span><b>خلال 48 ساعة</b></div>
        <div className="metric-line"><span>Business</span><b>تحويل يومي</b></div>
      </div>
    </DashboardShell>
  );
}
