import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DraftBanner } from "@/components/store/DraftBanner";
import { preloaderScript } from "@/lib/preloader";
import { Pixels } from "@/components/store/Pixels";
import { StoreShell } from "@/components/store/Shell";
import { getMerchant } from "@/lib/auth";
import { getPlatform } from "@/lib/platform";
import { canViewStore, getCatalog, getStoreBySlug, storeBase, storePublicUrl, toStoreDTO } from "@/lib/stores";

type Props = { params: Promise<{ store: string }>; children: React.ReactNode };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { store: slug } = await params;
  const store = await getStoreBySlug(slug);
  if (!store) return {};
  return {
    title: { default: `${store.name} — ${store.tagline}`, template: `%s — ${store.name}` },
    description: store.description,
    alternates: { canonical: storePublicUrl(store.slug) },
    openGraph: { title: store.name, description: store.description, siteName: store.name, locale: "ar_SA", type: "website" },
    robots: store.status === "live" ? undefined : { index: false, follow: false },
  };
}

export default async function StoreLayout({ params, children }: Props) {
  const { store: slug } = await params;
  const store = await getStoreBySlug(slug);
  if (!store) notFound();
  if (store.status !== "live") {
    const merchant = await getMerchant();
    if (!(await canViewStore(store, merchant?.id ?? null))) notFound();
  }
  const [catalog, platform, base] = await Promise.all([getCatalog(store.id), getPlatform(), storeBase(store.slug)]);
  const dto = toStoreDTO(store, base);

  return (
    <>
      {store.theme === "bold" && <script dangerouslySetInnerHTML={{ __html: preloaderScript(store.slug) }} />}
      <StoreShell
        store={dto}
        categories={catalog.categories}
        guaranteeDays={platform.guaranteeDays}
        banner={store.status === "draft" ? <DraftBanner claimed={store.merchantId !== null} /> : null}
      >
        {children}
      </StoreShell>
      <Pixels meta={dto.settings.metaPixelId} tiktok={dto.settings.tiktokPixelId} snap={dto.settings.snapPixelId} />
    </>
  );
}
