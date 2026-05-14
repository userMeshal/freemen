import DashboardShell from "../../components/DashboardShell";
import { shippingMethods } from "../../lib/data";
const content = <><div className="panel"><form className="form"><input className="input" placeholder="اسم طريقة الشحن"/><input className="input" placeholder="السعر"/><input className="input" placeholder="مدة التوصيل"/><input className="input" placeholder="المدن"/><button className="btn full" type="button">حفظ</button></form></div><div className="panel"><table><thead><tr><th>الطريقة</th><th>الشركة</th><th>السعر</th><th>المدة</th><th>الحالة</th></tr></thead><tbody>{shippingMethods.map(s=><tr key={s.name}><td>{s.name}</td><td>{s.company}</td><td>{s.price}</td><td>{s.duration}</td><td>{s.status}</td></tr>)}</tbody></table></div></>;
export default function Page() {
  return <DashboardShell title="الشحن" subtitle="حدد طرق الشحن.">{content}</DashboardShell>;
}
