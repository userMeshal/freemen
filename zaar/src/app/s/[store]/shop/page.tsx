import { notFound } from "next/navigation";
import { ShopView } from "@/components/store/ShopView";
import { getCatalog, getStoreBySlug } from "@/lib/stores";

export const metadata = { title: "كل المنتجات" };

export default async function ShopPage({ params, searchParams }: { params: Promise<{ store: string }>; searchParams: Promise<{ cat?: string; search?: string }> }) {
  const [{ store: slug }, sp] = await Promise.all([params, searchParams]);
  const store = await getStoreBySlug(slug);
  if (!store) notFound();
  const { products, categories } = await getCatalog(store.id);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const cards = products.map(({ description, images, stock, ...c }) => c);
  return <ShopView products={cards} categories={categories.filter((c) => c.count > 0)} initialCat={sp.cat ?? null} focusSearch={sp.search === "1"} />;
}
