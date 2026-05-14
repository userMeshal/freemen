import Link from "next/link";
import { products } from "../../../lib/data";
import ProductCard from "../../../components/ProductCard";
export default function StorePage({ params }: { params: { slug: string } }) {
  return <main className="wrap"><section><div className="storefront-hero"><span className="badge">Powered by Freemen</span><h1>Swan Matcha</h1><p>ماتشا فاخر ومنتجات هدايا ناعمة</p><small>/store/{params.slug}</small></div><h1>المنتجات</h1><div className="products-grid">{products.map(p=><ProductCard key={p.id} product={p}/>)}</div><div className="actions"><Link className="btn" href="/checkout">إتمام الطلب</Link></div></section></main>
}
