import DashboardShell from "@/components/DashboardShell";
import { paymentMethods } from "@/lib/data";

export default function PaymentsPage() {
  return (
    <DashboardShell title="المدفوعات" subtitle="طرق الدفع المتاحة للعميل داخل المتجر.">
      <div className="notice">مهم: الدفع الإلكتروني الحقيقي يحتاج مزود دفع أو ربط Marketplace. النسخة الحالية واجهة وتجهيز.</div>
      <div className="panel">
        <table>
          <thead><tr><th>طريقة الدفع</th><th>الرسوم</th><th>الحالة</th><th>إجراء</th></tr></thead>
          <tbody>
            {paymentMethods.map((p) => <tr key={p.name}><td>{p.name}</td><td>{p.fee}</td><td>{p.status}</td><td><button className="btn small">إعداد</button></td></tr>)}
          </tbody>
        </table>
      </div>
    </DashboardShell>
  );
}
