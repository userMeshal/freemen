import { demoStore } from "@/lib/data";
import StoreCard from "@/components/StoreCard";

export default function StorePage({ params }: { params: { slug: string } }) {
  return (
    <main className="wrap">
      <section>
        <div className="browser">
          <div className="store-head">
            <h1>{demoStore.name}</h1>
            <p>{demoStore.tagline}</p>
            <small>رابط المتجر: /store/{params.slug}</small>
          </div>
        </div>

        <section>
          <h2 className="section-title">المنتجات</h2>
          <p className="section-sub">واجهة العميل للشراء من المتجر.</p>
          <div className="products-grid">
            {demoStore.products.map((product) => (
              <StoreCard key={product.id} product={product} />
            ))}
          </div>
        </section>

        <div className="panel">
          <h2>Checkout تقريبي</h2>
          <p className="section-sub">هنا لاحقًا نضيف السلة والدفع وضمان مرسال.</p>
          <form className="form">
            <input className="input" placeholder="اسم العميل" />
            <input className="input" placeholder="رقم الجوال" />
            <input className="input full" placeholder="العنوان" />
            <select className="input full">
              <option>بدون ضمان مرسال</option>
              <option>تفعيل ضمان مرسال + 3 ر.س</option>
            </select>
            <button className="btn full" type="button">تأكيد الطلب</button>
          </form>
        </div>
      </section>
    </main>
  );
}
