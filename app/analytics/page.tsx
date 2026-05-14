import DashboardShell from "@/components/DashboardShell";

export default function AnalyticsPage() {
  return (
    <DashboardShell title="التقارير" subtitle="أرقام تساعد التاجر يعرف وش يبيع ووش يحتاج تحسين.">
      <div className="kpi-grid">
        <div className="kpi"><span>معدل التحويل</span><b>3.8%</b></div>
        <div className="kpi"><span>متوسط السلة</span><b>145 ر.س</b></div>
        <div className="kpi"><span>أكثر منتج مبيعًا</span><b>Swan Box</b></div>
        <div className="kpi"><span>زيارات اليوم</span><b>1,320</b></div>
      </div>
      <div className="panel">
        <h2>مؤشرات سريعة</h2>
        <div className="metric-line"><span>المنتجات التي تحتاج إعادة تخزين</span><b>1</b></div>
        <div className="metric-line"><span>الطلبات المكتملة هذا الأسبوع</span><b>42</b></div>
        <div className="metric-line"><span>نسبة تفعيل ضمان فريمان</span><b>18%</b></div>
      </div>
    </DashboardShell>
  );
}
