import { orders } from "@/lib/data";

const stores = [
  { name: "Swan Matcha", owner: "مشعل", plan: "Business", status: "موثق", sales: "12,450 ر.س" },
  { name: "Lamya Studio", owner: "لمياء", plan: "Pro", status: "جديد", sales: "2,190 ر.س" },
  { name: "Maramade", owner: "مرام", plan: "Free", status: "مراجعة", sales: "840 ر.س" },
];

export default function AdminPage() {
  return (
    <main className="wrap">
      <section>
        <span className="badge">لوحة الإدارة</span>
        <h1>إدارة فريمان</h1>
        <p className="lead">هذه صفحتك أنت كمالك المنصة: تتابع المتاجر، الطلبات، النزاعات، والتحويلات.</p>

        <div className="notice">
          مهم: صفحة الإدارة لاحقًا لازم تكون محمية بصلاحية Admin فقط.
        </div>

        <div className="stats">
          <div className="stat"><span>عدد المتاجر</span><b>3</b></div>
          <div className="stat"><span>إجمالي المبيعات</span><b>15,480 ر.س</b></div>
          <div className="stat"><span>طلبات اليوم</span><b>28</b></div>
          <div className="stat"><span>نزاعات مفتوحة</span><b>1</b></div>
        </div>

        <div className="admin-grid">
          <div className="panel">
            <h2>المتاجر</h2>
            <table>
              <thead>
                <tr><th>المتجر</th><th>الباقة</th><th>الحالة</th><th>المبيعات</th></tr>
              </thead>
              <tbody>
                {stores.map((store) => (
                  <tr key={store.name}>
                    <td>{store.name}</td>
                    <td>{store.plan}</td>
                    <td>{store.status}</td>
                    <td>{store.sales}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="panel">
            <h2>آخر الطلبات</h2>
            <table>
              <thead>
                <tr><th>الطلب</th><th>العميل</th><th>المبلغ</th><th>التحويل</th></tr>
              </thead>
              <tbody>
                {orders.slice(0, 3).map((order) => (
                  <tr key={order.id}>
                    <td>{order.id}</td>
                    <td>{order.customer}</td>
                    <td>{order.total}</td>
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
