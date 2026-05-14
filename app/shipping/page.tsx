import DashboardShell from "@/components/DashboardShell";
import { shippingMethods } from "@/lib/data";

export default function ShippingPage() {
  return (
    <DashboardShell title="الشحن" subtitle="حدد طرق الشحن وأسعارها ومناطق التغطية.">
      <div className="panel">
        <form className="form">
          <input className="input" placeholder="اسم طريقة الشحن" />
          <input className="input" placeholder="السعر" />
          <input className="input" placeholder="مدة التوصيل" />
          <input className="input" placeholder="المدن المشمولة" />
          <button className="btn full" type="button">حفظ طريقة الشحن</button>
        </form>
      </div>
      <div className="panel">
        <table>
          <thead><tr><th>الطريقة</th><th>الشركة</th><th>السعر</th><th>المدة</th><th>الحالة</th></tr></thead>
          <tbody>
            {shippingMethods.map((s) => <tr key={s.name}><td>{s.name}</td><td>{s.company}</td><td>{s.price}</td><td>{s.duration}</td><td>{s.status}</td></tr>)}
          </tbody>
        </table>
      </div>
    </DashboardShell>
  );
}
