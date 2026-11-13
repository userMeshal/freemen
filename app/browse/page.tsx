'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, SearchX } from 'lucide-react';
import { CategoryIcon, ListingCard } from '@/components/ui';
import { CATEGORIES, CITIES, KINDS } from '@/lib/data';
import { useStore } from '@/lib/store';

function Browse() {
  const params = useSearchParams();
  const { all } = useStore();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [cat, setCat] = useState(params.get('cat') ?? 'all');
  const [city, setCity] = useState('all');
  const [kind, setKind] = useState(params.get('kind') ?? 'all');

  const urlKind = params.get('kind');
  useEffect(() => setKind(urlKind ?? 'all'), [urlKind]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter(
      (l) =>
        (kind === 'all' || l.kind === kind) &&
        (cat === 'all' || l.category === cat) &&
        (city === 'all' || l.city === city) &&
        (!needle || [l.title, l.description, ...l.wants].join(' ').toLowerCase().includes(needle)),
    );
  }, [all, q, cat, city, kind]);

  return (
    <div className="container page">
      <header className="page-head">
        <span className="eyebrow">تصفّح</span>
        <h1 className="h2">{kind === 'auction' ? 'المزادات' : kind === 'sale' ? 'للبيع' : kind === 'swap' ? 'للبدل' : 'وش تدوّر عليه اليوم؟'}</h1>
      </header>

      <div className="tabs kind-tabs" role="tablist" aria-label="نوع العرض">
        {[{ id: 'all', name: 'الكل' }, ...KINDS].map((k) => (
          <button key={k.id} role="tab" aria-selected={kind === k.id} className={`tab ${kind === k.id ? 'is-on' : ''}`} onClick={() => setKind(k.id)}>
            {kind === k.id && <motion.span layoutId="kind-bg" className="tab-bg" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
            <span className="chip-in">{k.name}</span>
          </button>
        ))}
      </div>

      <div className="filters">
        <label className="search">
          <Search size={18} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث: آيفون، كنب، بلايستيشن…" aria-label="بحث" />
        </label>
        <select className="select" value={city} onChange={(e) => setCity(e.target.value)} aria-label="المدينة">
          <option value="all">كل المدن</option>
          {CITIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>

      <div className="chips" role="tablist" aria-label="الأقسام">
        {[{ id: 'all', name: 'الكل' }, ...CATEGORIES].map((c) => (
          <button key={c.id} role="tab" aria-selected={cat === c.id} className={`chip chip-btn ${cat === c.id ? 'is-on' : ''}`} onClick={() => setCat(c.id)}>
            {cat === c.id && <motion.span layoutId="chip-bg" className="chip-bg" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
            <span className="chip-in">{c.id !== 'all' && <CategoryIcon id={c.id} size={15} />} {c.name}</span>
          </button>
        ))}
      </div>

      <p className="result-count">{list.length} عرض</p>

      <motion.div layout className="grid">
        <AnimatePresence mode="popLayout">
          {list.map((l, i) => <ListingCard key={l.id} listing={l} index={i} />)}
        </AnimatePresence>
      </motion.div>

      {list.length === 0 && (
        <motion.div className="empty" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <SearchX size={36} strokeWidth={1.3} />
          <h3>ما لقينا شي بهالمواصفات</h3>
          <p>جرّب قسم ثاني أو امسح البحث.</p>
          <button className="btn btn-ghost" onClick={() => { setQ(''); setCat('all'); setCity('all'); setKind('all'); }}>امسح الفلاتر</button>
        </motion.div>
      )}
    </div>
  );
}

export default function Page() {
  return <Suspense><Browse /></Suspense>;
}
