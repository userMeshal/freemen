import DashboardShell from "../../components/DashboardShell";
import { paymentMethods } from "../../lib/data";
const content = <><div className="notice">الدفع الحقيقي يحتاج ربط مزود دفع. هنا واجهة جاهزة للربط.</div><div className="panel"><table><thead><tr><th>طريقة الدفع</th><th>الرسوم</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody>{paymentMethods.map(p=><tr key={p.name}><td>{p.name}</td><td>{p.fee}</td><td>{p.status}</td><td><button className="btn small">إعداد</button></td></tr>)}</tbody></table></div></>;
export default function Page() {
  return <DashboardShell title="المدفوعات" subtitle="طرق الدفع داخل المتجر.">{content}</DashboardShell>;
}
