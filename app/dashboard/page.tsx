import DashboardShell from "@/components/DashboardShell";
import { orders } from "@/lib/data";

export default function DashboardPage() {
  return (
    <DashboardShell title="لوحة التاجر" subtitle="نظرة عامة على مبيعاتك وطلباتك وتحويلاتك.">
      <div className="kpi-grid">
        <div className="kpi"><span>مبيعات اليوم</span><b>1,245 ر.س</b></div>
        <div className="kpi"><span>طلبات جديدة</span><b>14</b></div>
        <div className="kpi"><span>قابل للتحويل</span><b>920 ر.س</b></div>
        <div className="kpi"><span>حالة التاجر</span><b>موثق</b></div>
      </div>

      <div className="two-col">
        <div className="panel">
          <h2>آخر الطلبات</h2>
          <table>
            <thead><tr><th>الطلب</th><th>العميل</th><th>المبلغ</th><th>الحالة</th></tr></thead>
            <tbody>
              {orders.slice(0,4).map((order) => (
                <tr key={order.id}><td>{order.id}</td><td>{order.customer}</td><td>{order.total}</td><td>{order.status}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="panel">
          <h2>مركز التنبيهات</h2>
          <div className="metric-line"><span>طلب يحتاج تجهيز</span><b>2</b></div>
          <div className="metric-line"><span>منتجات مخزونها منخفض</span><b>1</b></div>
          <div className="metric-line"><span>نزاعات مفتوحة</span><b>1</b></div>
          <div className="metric-line"><span>تحويلات قادمة</span><b>920 ر.س</b></div>
        </div>
      </div>
    </DashboardShell>
  );
}
