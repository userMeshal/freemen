import DashboardShell from "@/components/DashboardShell";
import { adminStores, orders } from "@/lib/data";

export default function AdminPage() {
  return (
    <DashboardShell title="إدارة فريمان" subtitle="لوحة مالك المنصة لمتابعة المتاجر والمخاطر والتحويلات.">
      <div className="notice">هذه الصفحة لاحقًا تكون محمية بصلاحية Admin فقط.</div>
      <div className="kpi-grid">
        <div className="kpi"><span>عدد المتاجر</span><b>3</b></div>
        <div className="kpi"><span>إجمالي المبيعات</span><b>15,480 ر.س</b></div>
        <div className="kpi"><span>طلبات اليوم</span><b>28</b></div>
        <div className="kpi"><span>نزاعات مفتوحة</span><b>1</b></div>
      </div>

      <div className="two-col">
        <div className="panel">
          <h2>المتاجر</h2>
          <table>
            <thead><tr><th>المتجر</th><th>الباقة</th><th>الحالة</th><th>الخطر</th><th>المبيعات</th></tr></thead>
            <tbody>
              {adminStores.map((store) => (
                <tr key={store.name}><td>{store.name}</td><td>{store.plan}</td><td>{store.status}</td><td>{store.risk}</td><td>{store.sales}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="panel">
          <h2>آخر الطلبات</h2>
          <table>
            <thead><tr><th>الطلب</th><th>العميل</th><th>المبلغ</th><th>التحويل</th></tr></thead>
            <tbody>
              {orders.slice(0,4).map((order) => (
                <tr key={order.id}><td>{order.id}</td><td>{order.customer}</td><td>{order.total}</td><td>{order.payout}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardShell>
  );
}
