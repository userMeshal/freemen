import DashboardShell from "../../components/DashboardShell";
import { orders } from "../../lib/data";
const content = <><div className="kpi-grid"><div className="kpi"><span>مبيعات اليوم</span><b>1,245 ر.س</b></div><div className="kpi"><span>طلبات جديدة</span><b>14</b></div><div className="kpi"><span>قابل للتحويل</span><b>920 ر.س</b></div><div className="kpi"><span>حالة التاجر</span><b>موثق</b></div></div><div className="two-col"><div className="panel"><h2>آخر الطلبات</h2><table><thead><tr><th>الطلب</th><th>العميل</th><th>المبلغ</th><th>الحالة</th></tr></thead><tbody>{orders.slice(0,4).map(o=><tr key={o.id}><td>{o.id}</td><td>{o.customer}</td><td>{o.total}</td><td>{o.status}</td></tr>)}</tbody></table></div><div className="panel"><h2>تنبيهات</h2><div className="metric-line"><span>طلب يحتاج تجهيز</span><b>2</b></div><div className="metric-line"><span>مخزون منخفض</span><b>1</b></div><div className="metric-line"><span>نزاعات مفتوحة</span><b>1</b></div></div></div></>;
export default function Page() {
  return <DashboardShell title="لوحة التاجر" subtitle="نظرة عامة على مبيعاتك وطلباتك وتحويلاتك.">{content}</DashboardShell>;
}
