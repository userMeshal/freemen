import DashboardShell from "@/components/DashboardShell";
import { orders } from "@/lib/data";

export default function OrdersPage() {
  return (
    <DashboardShell title="الطلبات" subtitle="تابع الطلبات، الشحن، التحويل، وحالات النزاع.">
      <div className="toolbar">
        <div className="search-row">
          <input className="input" placeholder="ابحث برقم الطلب أو العميل" />
          <select className="input"><option>كل الحالات</option><option>تم الدفع</option><option>تم الشحن</option><option>نزاع مفتوح</option></select>
        </div>
      </div>
      <div className="panel">
        <table>
          <thead><tr><th>الطلب</th><th>العميل</th><th>التاريخ</th><th>المبلغ</th><th>الطلب</th><th>الشحن</th><th>التحويل</th></tr></thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}><td>{o.id}</td><td>{o.customer}</td><td>{o.date}</td><td>{o.total}</td><td>{o.status}</td><td>{o.shipping}</td><td>{o.payout}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardShell>
  );
}
