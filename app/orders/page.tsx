import DashboardShell from "../../components/DashboardShell";
import { orders } from "../../lib/data";
const content = <div className="panel"><table><thead><tr><th>الطلب</th><th>العميل</th><th>التاريخ</th><th>المبلغ</th><th>الحالة</th><th>الشحن</th><th>التحويل</th></tr></thead><tbody>{orders.map(o=><tr key={o.id}><td>{o.id}</td><td>{o.customer}</td><td>{o.date}</td><td>{o.total}</td><td>{o.status}</td><td>{o.shipping}</td><td>{o.payout}</td></tr>)}</tbody></table></div>;
export default function Page() {
  return <DashboardShell title="الطلبات" subtitle="تابع الطلبات والشحن والتحويل.">{content}</DashboardShell>;
}
