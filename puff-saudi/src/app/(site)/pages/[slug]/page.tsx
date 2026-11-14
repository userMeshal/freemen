import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPage } from "@/lib/catalog";
import { sanitizeHtml, stripHtml } from "@/lib/normalize";
import { PageHero } from "@/components/site/PageHero";
import { Reveal } from "@/components/ui/Reveal";

export const revalidate = 3600;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await getPage((await params).slug);
  if (!page) return { title: "الصفحة غير موجودة" };
  return {
    title: page.title,
    description: stripHtml(page.bodyHtml).slice(0, 160),
    alternates: { canonical: `/pages/${page.slug}` },
  };
}

export default async function PolicyPage({ params }: Props) {
  const page = await getPage((await params).slug);
  if (!page) notFound();
  return (
    <>
      <PageHero eyebrow="PUFF SAUDI" title={page.title} crumbs={[{ label: page.title }]} />
      <div className="wrap pb-24 md:pb-32">
        <Reveal as="article" className="prose-puff max-w-3xl border-t border-line pt-8">
          <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(page.bodyHtml) }} />
        </Reveal>
      </div>
    </>
  );
}
