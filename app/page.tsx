import Link from "next/link";
import { products, plans } from "../lib/data";

export default function HomePage() {
  return (
    <main className="wrap">
      <section className="hero">
        <div>
          <span className="badge">منصة متاجر للتجار الصغار</span>
          <h1>افتح متجرك الإلكتروني خلال دقائق.</h1>
          <p className="lead">فريمان منصة متاجر جاهزة تساعد التاجر يبيع أونلاين: منتجات، طلبات، عملاء، كوبونات، شحن، مدفوعات، محفظة، وتصميم متجر.</p>
          <div className="actions"><Link className="btn" href="/register">افتح متجرك</Link><Link className="btn secondary" href="/dashboard">جرّب لوحة التاجر</Link></div>
          <div className="mini"><div><strong>متجر جاهز</strong><span>رابط وصفحات منتجات</span></div><div><strong>تحويلات أسرع</strong><span>حسب الباقة والثقة</span></div><div><strong>ضمان فريمان</strong><span>حماية اختيارية للعميل</span></div></div>
        </div>
        <div className="mock"><div className="browser"><div className="dots"><i></i><i></i><i></i></div><div className="store-head"><h3>Swan Matcha</h3><p>متجر تجريبي يعمل على فريمان</p></div><div className="products">{products.slice(0,4).map(p=><div className="product" key={p.id}><div className="pic">{p.emoji}</div><b>{p.name}</b><span>{p.price} ر.س</span></div>)}</div></div></div>
      </section>
      <section><h1>الباقات</h1><div className="mini">{plans.map(p=><div key={p.name}><strong>{p.name}</strong><span>{p.desc}</span><h2>{p.price}</h2><ul>{p.features.map(f=><li key={f}>{f}</li>)}</ul></div>)}</div></section>
    </main>
  );
}
