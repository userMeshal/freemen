import { demoStore } from "@/lib/data";
import StoreCard from "@/components/StoreCard";

export default function StorePage({ params }: { params: { slug: string } }) {
  return (
    <main className="wrap">
      <section>
        <div className="storefront-hero">
          <span className="badge">Powered by Freemen</span>
          <h1>{demoStore.name}</h1>
          <p>{demoStore.tagline}</p>
          <small>رابط المتجر: /store/{params.slug}</small>
        </div>

        <section>
          <h2 className="section-title">المنتجات</h2>
          <p className="section-sub">واجهة العميل للشراء من المتجر.</p>
          <div className="products-grid">
            {demoStore.products.map((product) => <StoreCard key={product.id} product={product} />)}
          </div>
        </section>

        <div className="checkout-box">
          <h2>إتمام الطلب</h2>
          <p className="section-sub">نموذج أولي للسلة والدفع وضمان فريمان.</p>
          <form className="form">
            <input className="input" placeholder="اسم العميل" />
            <input className="input" placeholder="رقم الجوال" />
            <input className="input full" placeholder="العنوان" />
            <select className="input full">
              <option>بدون ضمان فريمان</option>
              <option>تفعيل ضمان فريمان + 3 ر.س</option>
            </select>
            <button className="btn full" type="button">تأكيد الطلب</button>
          </form>
        </div>
      </section>
    </main>
  );
}
