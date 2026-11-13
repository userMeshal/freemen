import type { Metadata } from 'next';
import Link from 'next/link';
import { POLICIES } from '@/lib/policies';
import { SITE } from '@/lib/site';

export const metadata: Metadata = { title: 'السياسات', description: `سياسات ${SITE.name}: الشروط، الخصوصية، الإلغاء والاسترجاع، الحماية، والأغراض الممنوعة.` };

export default function PoliciesIndex() {
  return (
    <div className="container page">
      <header className="page-head">
        <span className="eyebrow">السياسات</span>
        <h1 className="h2">كل شي واضح من البداية.</h1>
      </header>
      <div className="policy-cards">
        {POLICIES.map((p) => (
          <Link key={p.slug} href={`/policies/${p.slug}`} className="policy-card">
            <h2>{p.title}</h2>
            <p>{p.summary}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
