import DashboardShell from "@/components/DashboardShell";
import { coupons } from "@/lib/data";

export default function CouponsPage() {
  return (
    <DashboardShell title="الكوبونات" subtitle="أنشئ أكواد خصم للعروض والحملات.">
      <div className="panel">
        <form className="form">
          <input className="input" placeholder="كود الخصم: WELCOME10" />
          <input className="input" placeholder="نسبة أو مبلغ الخصم" />
          <input className="input" placeholder="الحد الأدنى للطلب" />
          <input className="input" placeholder="عدد الاستخدامات" />
          <button className="btn full" type="button">إنشاء كوبون</button>
        </form>
      </div>
      <div className="panel">
        <table>
          <thead><tr><th>الكود</th><th>الخصم</th><th>الاستخدام</th><th>الحالة</th></tr></thead>
          <tbody>
            {coupons.map((c) => <tr key={c.code}><td>{c.code}</td><td>{c.discount}</td><td>{c.usage}</td><td>{c.status}</td></tr>)}
          </tbody>
        </table>
      </div>
    </DashboardShell>
  );
}
