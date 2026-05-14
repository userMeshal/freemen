type Product = {
  id: number;
  name: string;
  price: number;
  emoji: string;
  stock: number;
};

export default function StoreCard({ product }: { product: Product }) {
  return (
    <article className="product-card">
      <div className="product-pic">{product.emoji}</div>
      <div>
        <h3>{product.name}</h3>
        <p>المخزون: {product.stock}</p>
      </div>
      <strong>{product.price} ر.س</strong>
      <button className="btn small">أضف للسلة</button>
    </article>
  );
}
