'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Gavel, Heart, Inbox, LogOut, Plus, Send } from 'lucide-react';
import OfferRow from '@/components/OfferRow';
import { ListingArt, ListingCard } from '@/components/ui';
import { auctionEnded, auctionStatus, formatSAR } from '@/lib/data';
import { useStore } from '@/lib/store';

const TABS = [
  { id: 'in', label: 'وصلتني', icon: Inbox },
  { id: 'out', label: 'أرسلتها', icon: Send },
  { id: 'fav', label: 'المفضلة', icon: Heart },
] as const;

export default function OffersPage() {
  const { listings, offers, all, favs, me, ready, cloud, authed, email, signOut, entries } = useStore();
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('in');
  const sent = offers.filter((o) => o.fromId === me.id);
  const favList = all.filter((l) => favs.includes(l.id));
  const counts = { in: offers.length - sent.length, out: sent.length + entries.length, fav: favList.length };
  const ENTRY = { pending: 'قيد التحقق من التحويل', approved: 'دخولك مفعّل', rejected: 'لم يتطابق التحويل' } as const;

  if (ready && !authed) {
    return (
      <div className="container page page-narrow empty">
        <h1 className="h2">سجّل دخولك</h1>
        <p className="lead">عشان تشوف العروض اللي وصلتك واللي أرسلتها ومزاداتك.</p>
        <Link href="/login?next=/offers" className="btn btn-primary btn-lg">دخول / حساب جديد</Link>
      </div>
    );
  }

  return (
    <div className="container page page-narrow">
      <header className="page-head account-head">
        <div>
          <span className="eyebrow">{cloud && me.name ? `هلا ${me.name}` : 'حسابي'}</span>
          <h1 className="h2">عروضي</h1>
        </div>
        {cloud && (
          <button className="btn btn-ghost btn-sm" onClick={() => signOut()} title={email}><LogOut size={15} /> خروج</button>
        )}
      </header>

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={`tab ${tab === t.id ? 'is-on' : ''}`} onClick={() => setTab(t.id)}>
            {tab === t.id && <motion.span layoutId="tab-bg" className="tab-bg" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
            <span className="chip-in"><t.icon size={16} /> {t.label} {counts[t.id] > 0 && <b>{counts[t.id]}</b>}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}>
          {tab === 'in' && (
            listings.length === 0 ? (
              <Empty title="ما عرضت شي للحين" text="اعرض أول غرض: للبدل، للبيع، أو بمزاد." />
            ) : (
              listings.map((l) => {
                const incoming = offers.filter((o) => o.listingId === l.id);
                return (
                  <section key={l.id} className="mine">
                    <Link href={`/listing/${l.id}`} className="mine-head">
                      <span className="mine-thumb"><ListingArt listing={l} iconSize={22} /></span>
                      <div>
                        <strong>{l.title}</strong>
                        <small>
                          {l.kind === 'auction'
                            ? `مزاد · ${l.bidsCount ?? 0} مزايدة${l.currentBid ? ` · الأعلى ${formatSAR(l.currentBid)}` : ''} · ${auctionStatus(l)}`
                            : incoming.length ? `${incoming.length} ${l.kind === 'sale' ? 'طلب شراء' : 'عرض بدل'}` : 'بانتظار أول عرض…'}
                        </small>
                      </div>
                    </Link>
                    <AnimatePresence initial={false}>
                      {incoming.map((o) => <OfferRow key={o.id} offer={o} listing={l} role="owner" />)}
                    </AnimatePresence>
                    {incoming.length === 0 && l.kind !== 'auction' && <div className="waiting"><span /><span /><span /></div>}
                  </section>
                );
              })
            )
          )}

          {tab === 'out' && (
            sent.length + entries.length === 0 ? (
              <Empty title="ما أرسلت أي عرض" text="تصفّح السوق: اعرض بدلك، اطلب الشراء، أو ادخل مزاد." href="/browse" cta="تصفّح السوق" />
            ) : (
              <>
                {entries.map((e) => {
                  const l = all.find((x) => x.id === e.listingId);
                  return (
                    <Link key={e.id} href={`/listing/${e.listingId}`} className={`offer offer-${e.status === 'approved' ? 'accepted' : e.status}`}>
                      <div className="offer-thumb"><Gavel size={24} strokeWidth={1.4} /></div>
                      <div className="offer-main">
                        <div className="offer-top">
                          <strong>مزاد: {l?.title ?? 'مزاد محذوف'}</strong>
                          <span className={`status status-${e.status === 'approved' ? 'accepted' : e.status}`}>{ENTRY[e.status]}</span>
                          {e.demo && <span className="status status-demo">تجريبي</span>}
                        </div>
                        {l && (
                          <div className="offer-sub">
                            <span>{l.currentBid ? `أعلى مزايدة ${formatSAR(l.currentBid)}` : `يبدأ من ${formatSAR(l.price ?? 0)}`}</span>
                            <span suppressHydrationWarning>{auctionStatus(l)}</span>
                            {l.topBidder === me.id && <span className="fair-tag fair-2">{auctionEnded(l) ? 'فزت بالمزاد' : 'أنت الأعلى'}</span>}
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}
                {sent.map((o) => <OfferRow key={o.id} offer={o} listing={all.find((l) => l.id === o.listingId)} role="sender" />)}
              </>
            )
          )}

          {tab === 'fav' && (
            favList.length === 0 ? (
              <Empty title="المفضلة فاضية" text="اضغط القلب على أي عرض عشان ترجع له بعدين." href="/browse" cta="تصفّح العروض" />
            ) : (
              <div className="grid grid-2">{favList.map((l, i) => <ListingCard key={l.id} listing={l} index={i} />)}</div>
            )
          )}
        </motion.div>
      </AnimatePresence>
      {!ready && <div className="skeleton" />}
    </div>
  );
}

function Empty({ title, text, href = '/new', cta = 'اعرض غرضك' }: { title: string; text: string; href?: string; cta?: string }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      <p>{text}</p>
      <Link href={href} className="btn btn-primary"><Plus size={16} /> {cta}</Link>
    </div>
  );
}
