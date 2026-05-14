export default function ProductCard({ product }: { product: { name: string; price: number; emoji: string; stock: number; category?: string } }) {
  return (
    <article className="product-card">
      <div className="product-pic">{product.emoji}</div>
      <h3>{product.name}</h3>
      <p>{product.category || "منتج"} · المخزون {product.stock}</p>
      <strong>{product.price} ر.س</strong>
      <button className="btn small">أضف للسلة</button>
    </article>
  );
}
