import type { Metadata } from "next";
import { and, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ProductView } from "@/components/store/ProductView";
import { db } from "@/db";
import { reviews } from "@/db/schema";
import { getCatalog, getStoreBySlug, storePublicUrl } from "@/lib/stores";

type Props = { params: Promise<{ store: string; slug: string }> };

async function load(params: Props["params"]) {
  const { store: storeSlug, slug } = await params;
  const store = await getStoreBySlug(storeSlug);
  if (!store) return null;
  const { products } = await getCatalog(store.id);
  const product = products.find((p) => p.slug === slug);
  return product ? { store, product, products } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await load(params);
  if (!data) return {};
  const { product, store } = data;
  return {
    title: product.name,
    description: product.description.slice(0, 160),
    alternates: { canonical: `${storePublicUrl(store.slug)}/p/${product.slug}` },
    openGraph: { title: `${product.name} — ${store.name}`, description: product.description.slice(0, 160), images: product.images.slice(0, 1) },
  };
}

export default async function ProductPage({ params }: Props) {
  const data = await load(params);
  if (!data) notFound();
  const { store, product, products } = data;
  const list = await db
    .select({ id: reviews.id, name: reviews.name, rating: reviews.rating, body: reviews.body, createdAt: reviews.createdAt })
    .from(reviews)
    .where(and(eq(reviews.productId, product.id), eq(reviews.hidden, false)))
    .orderBy(desc(reviews.id))
    .limit(20);
  const related = products
    .filter((p) => p.id !== product.id && p.categoryId === product.categoryId)
    .concat(products.filter((p) => p.id !== product.id && p.categoryId !== product.categoryId))
    .slice(0, 4)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    .map(({ description, images, stock, ...c }) => c);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    ...(product.images.length ? { image: product.images } : {}),
    brand: { "@type": "Brand", name: store.name },
    offers: {
      "@type": "Offer",
      priceCurrency: "SAR",
      price: (product.price / 100).toFixed(2),
      availability: product.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: `${storePublicUrl(store.slug)}/p/${product.slug}`,
    },
    ...(product.rating ? { aggregateRating: { "@type": "AggregateRating", ratingValue: product.rating, reviewCount: product.reviewsCount } } : {}),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <ProductView product={product} reviews={list.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))} related={related} />
    </>
  );
}
