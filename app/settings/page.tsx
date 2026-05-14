import DashboardShell from "../../components/DashboardShell";
const content = <div className="panel"><form className="form"><input className="input" defaultValue="Swan Matcha"/><input className="input" defaultValue="swan"/><input className="input" placeholder="واتساب"/><input className="input" placeholder="إنستقرام"/><textarea className="input full" rows={4} placeholder="سياسة الشحن"></textarea><button className="btn full" type="button">حفظ</button></form></div>;
export default function Page(){return <DashboardShell title="الإعدادات" subtitle="تعديل بيانات المتجر.">{content}</DashboardShell>}
