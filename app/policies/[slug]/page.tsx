import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { POLICIES, policyBySlug } from '@/lib/policies';
import { SITE } from '@/lib/site';

export const dynamicParams = false;
export const generateStaticParams = () => POLICIES.map((p) => ({ slug: p.slug }));

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const policy = policyBySlug(params.slug);
  return policy ? { title: policy.title, description: policy.summary } : {};
}

export default function PolicyPage({ params }: { params: { slug: string } }) {
  const policy = policyBySlug(params.slug);
  if (!policy) notFound();

  return (
    <div className="container page policy-layout">
      <nav className="policy-nav" aria-label="السياسات">
        {POLICIES.map((p) => (
          <Link key={p.slug} href={`/policies/${p.slug}`} className={p.slug === policy.slug ? 'is-active' : ''} aria-current={p.slug === policy.slug ? 'page' : undefined}>
            {p.title}
          </Link>
        ))}
      </nav>

      <article className="policy">
        <span className="eyebrow">سياسات {SITE.name}</span>
        <h1 className="h2">{policy.title}</h1>
        <p className="policy-summary">{policy.summary}</p>
        <p className="policy-date">آخر تحديث: {SITE.policiesUpdated}</p>

        {policy.sections.map((s) => (
          <section key={s.title}>
            <h2>{s.title}</h2>
            {s.text?.map((t) => <p key={t}>{t}</p>)}
            {s.list && <ul>{s.list.map((li) => <li key={li}>{li}</li>)}</ul>}
          </section>
        ))}

        {(SITE.contactEmail || SITE.operator) && (
          <div className="policy-contact">
            {SITE.operator && <p>الجهة المشغّلة: {SITE.operator}{SITE.registration && ` — ${SITE.registration}`}</p>}
            {SITE.contactEmail && (
              <p>للاستفسارات والشكاوى وطلبات حذف البيانات: <a href={`mailto:${SITE.contactEmail}`} dir="ltr">{SITE.contactEmail}</a></p>
            )}
          </div>
        )}
      </article>
    </div>
  );
}
