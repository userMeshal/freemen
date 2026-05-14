import { demoStore } from "@/lib/data";
import StoreCard from "@/components/StoreCard";

export default function ProductsPage() {
  return (
    <main className="wrap">
      <section>
        <h1>إدارة المنتجات</h1>
        <p className="lead">هذي صفحة أولية لإضافة المنتجات. حاليًا النموذج شكلي، وبعد الربط بقاعدة البيانات بيحفظ فعليًا.</p>

        <div className="panel">
          <h2>إضافة منتج جديد</h2>
          <form className="form">
            <input className="input" placeholder="اسم المنتج" />
            <input className="input" placeholder="السعر" />
            <input className="input" placeholder="الكمية" />
            <input className="input" placeholder="رابط الصورة أو ارفع صورة لاحقًا" />
            <textarea className="input full" placeholder="وصف المنتج" rows={4}></textarea>
            <button className="btn full" type="button">حفظ المنتج</button>
          </form>
        </div>

        <h2 className="section-title">منتجات المتجر</h2>
        <div className="products-grid">
          {demoStore.products.map((product) => (
            <StoreCard key={product.id} product={product} />
          ))}
        </div>
      </section>
    </main>
  );
}
