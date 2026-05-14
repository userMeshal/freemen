import { orders } from "@/lib/data";

export default function OrdersPage() {
  return (
    <main className="wrap">
      <section>
        <h1>الطلبات</h1>
        <p className="lead">هنا التاجر يتابع الطلبات ويغير حالتها.</p>

        <div className="panel">
          <table>
            <thead>
              <tr>
                <th>رقم الطلب</th>
                <th>العميل</th>
                <th>المبلغ</th>
                <th>حالة الطلب</th>
                <th>حالة التحويل</th>
                <th>إجراء</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>{order.id}</td>
                  <td>{order.customer}</td>
                  <td>{order.total}</td>
                  <td><span className="status-pill ok">{order.status}</span></td>
                  <td><span className="status-pill hold">{order.payout}</span></td>
                  <td><button className="btn small">تحديث الحالة</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
