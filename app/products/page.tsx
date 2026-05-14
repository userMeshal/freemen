import DashboardShell from "../../components/DashboardShell";
import { products } from "../../lib/data";
const content = <><div className="toolbar"><div className="search-row"><input className="input" placeholder="ابحث عن منتج"/><select className="input"><option>كل التصنيفات</option></select></div><button className="btn">إضافة منتج</button></div><div className="panel"><form className="form"><input className="input" placeholder="اسم المنتج"/><input className="input" placeholder="السعر"/><input className="input" placeholder="المخزون"/><input className="input" placeholder="التصنيف"/><textarea className="input full" rows={4} placeholder="وصف المنتج"></textarea><button className="btn full" type="button">حفظ المنتج</button></form></div><div className="panel"><table><thead><tr><th>المنتج</th><th>التصنيف</th><th>السعر</th><th>المخزون</th><th>الحالة</th></tr></thead><tbody>{products.map(p=><tr key={p.id}><td>{p.emoji} {p.name}</td><td>{p.category}</td><td>{p.price} ر.س</td><td>{p.stock}</td><td>{p.status}</td></tr>)}</tbody></table></div></>;
export default function Page() {
  return <DashboardShell title="المنتجات" subtitle="أضف وعدل منتجاتك.">{content}</DashboardShell>;
}
