import { orders } from "@/lib/data";
import Link from "next/link";

export default function DashboardPage() {
  return (
    <main className="wrap">
      <section>
        <h1>لوحة التاجر</h1>
        <p className="lead">تصور أولي للشاشة اللي بيشوفها التاجر بعد التسجيل.</p>

        <div className="dashboard">
          <aside className="side">
            <Link className="active" href="/dashboard">الرئيسية</Link>
            <Link href="/products">المنتجات</Link>
            <Link href="/orders">الطلبات</Link>
            <Link href="#">المدفوعات</Link>
            <Link href="/settings">إعدادات المتجر</Link>
          </aside>

          <div className="dash-main">
            <div className="stats">
              <div className="stat"><span>مبيعات اليوم</span><b>1,245 ر.س</b></div>
              <div className="stat"><span>طلبات جديدة</span><b>14</b></div>
              <div className="stat"><span>قابل للتحويل</span><b>920 ر.س</b></div>
              <div className="stat"><span>حالة التاجر</span><b>موثق</b></div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>الطلب</th>
                  <th>العميل</th>
                  <th>المبلغ</th>
                  <th>الحالة</th>
                  <th>التحويل</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>{order.id}</td>
                    <td>{order.customer}</td>
                    <td>{order.total}</td>
                    <td className={order.status === "نزاع مفتوح" ? "danger" : "ok"}>{order.status}</td>
                    <td>{order.payout}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}
