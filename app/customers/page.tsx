import DashboardShell from "../../components/DashboardShell";
import { customers } from "../../lib/data";
const content = <div className="panel"><table><thead><tr><th>العميل</th><th>الجوال</th><th>عدد الطلبات</th><th>إجمالي الشراء</th><th>التصنيف</th></tr></thead><tbody>{customers.map(c=><tr key={c.name}><td>{c.name}</td><td>{c.phone}</td><td>{c.orders}</td><td>{c.total}</td><td>{c.type}</td></tr>)}</tbody></table></div>;
export default function Page() {
  return <DashboardShell title="العملاء" subtitle="كل عملاء متجرك.">{content}</DashboardShell>;
}
