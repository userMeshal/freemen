import Link from "next/link";
import { demoStore } from "@/lib/data";

export default function HomePage() {
  return (
    <main className="wrap">
      <section className="hero">
        <div>
          <span className="badge">⚡ منصة متاجر للتجار الصغار</span>
          <h1>افتح متجرك الإلكتروني خلال دقائق.</h1>
          <p className="lead">
            فريمان تعطي التاجر متجر جاهز، منتجات، طلبات، دفع، وتحويلات أسرع.
            والعميل يقدر يطلب بضمان فريمان لحماية مبلغ الطلب حتى الاستلام.
          </p>
          <div className="actions">
            <Link className="btn" href="/dashboard">جرّب لوحة التاجر</Link>
            <Link className="btn secondary" href="/store/swan">شوف متجر تجريبي</Link>
          </div>
          <div className="mini">
            <div><strong>10 دقائق</strong><span>لإنشاء متجر تقريبي</span></div>
            <div><strong>يومي</strong><span>تحويلات أسرع للتجار الموثقين</span></div>
            <div><strong>ضمان</strong><span>حماية اختيارية للعميل</span></div>
          </div>
        </div>

        <div className="mock">
          <div className="browser">
            <div className="dots"><i></i><i></i><i></i></div>
            <div className="store-head">
              <h3>{demoStore.name}</h3>
              <p>{demoStore.banner}</p>
            </div>
            <div className="products">
              {demoStore.products.slice(0, 4).map((p) => (
                <div className="product" key={p.id}>
                  <div className="pic">{p.emoji}</div>
                  <b>{p.name}</b>
                  <span>{p.price} ر.س</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="section-title">وش يميّز منصتك؟</h2>
        <p className="section-sub">الفكرة مب بس متجر، الفكرة تجيب التاجر بسبب سرعة الفلوس وسهولة البيع.</p>
        <div className="grid3">
          <div className="card feature"><h3>تحويلات أسرع</h3><p>التاجر الموثق يقدر يحصل على تحويل يومي حسب الباقة والثقة.</p></div>
          <div className="card feature"><h3>ضمان فريمان</h3><p>خيار للعميل يحمي مبلغ الطلب حتى تأكيد الاستلام، برسوم بسيطة.</p></div>
          <div className="card feature"><h3>متجر جاهز</h3><p>رابط متجر، منتجات، صور، طلبات، حالات شحن، ولوحة تاجر بسيطة.</p></div>
        </div>
      </section>
    </main>
  );
}
