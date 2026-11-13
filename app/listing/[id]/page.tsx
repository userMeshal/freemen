'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Clock, Heart, MapPin, Repeat2, ShieldCheck, Trash2 } from 'lucide-react';
import OfferModal from '@/components/OfferModal';
import OfferRow from '@/components/OfferRow';
import { CategoryIcon, EASE, ListingArt, ListingCard } from '@/components/ui';
import { catById, formatSAR, listingValue, timeAgo } from '@/lib/data';
import { useStore } from '@/lib/store';

export default function ListingPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { all, ready, me, favs, toggleFav, offersFor, removeListing, toast, authed } = useStore();
  const [open, setOpen] = useState(false);
  const [shot, setShot] = useState(0);
  const listing = all.find((l) => l.id === params.id);

  if (!listing) {
    if (!ready) return <div className="container page"><div className="skeleton" /></div>;
    return (
      <div className="container page empty">
        <h1 className="h2">هذا العرض مو موجود</h1>
        <p>يمكن انحذف أو تم البدل عليه.</p>
        <Link href="/browse" className="btn btn-primary">تصفّح العروض</Link>
      </div>
    );
  }

  const mine = !!me.id && listing.ownerId === me.id;
  const offers = offersFor(listing.id);
  const myOffer = offers.find((o) => o.fromId === me.id);
  const fav = favs.includes(listing.id);
  const cat = catById(listing.category);
  const similar = all.filter((l) => l.category === listing.category && l.id !== listing.id).slice(0, 4);
  const total = listing.offersCount ?? (listing.seedOffers ?? 0) + offers.length;

  return (
    <div className="container page">
      <Link href="/browse" className="back"><ArrowRight size={16} /> كل العروض</Link>

      <div className="detail">
        <motion.div className="detail-media" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, ease: EASE }}>
          <ListingArt listing={{ ...listing, images: listing.images.slice(shot) }} iconSize={120} />
          {listing.images.length > 1 && (
            <div className="thumbs">
              {listing.images.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <button key={i} className={i === shot ? 'is-on' : ''} onClick={() => setShot(i)} aria-label={`صورة ${i + 1}`}><img src={src} alt="" /></button>
              ))}
            </div>
          )}
        </motion.div>

        <motion.div className="detail-info" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: EASE, delay: 0.1 }}>
          <div className="detail-tags">
            <Link href={`/browse?cat=${cat.id}`} className="chip"><CategoryIcon id={cat.id} size={14} /> {cat.name}</Link>
            <span className="chip">{listing.condition}</span>
          </div>
          <h1 className="detail-title">{listing.title}</h1>
          <div className="detail-meta">
            <span><MapPin size={15} /> {listing.city}</span>
            <span suppressHydrationWarning><Clock size={15} /> {timeAgo(listing.createdAt)}</span>
            <span><Repeat2 size={15} /> {total} عرض بدل</span>
          </div>
          <p className="detail-desc">{listing.description || 'ما فيه وصف إضافي.'}</p>

          <div className="wants-box">
            <span className="label">يبي بداله</span>
            <div className="chips chips-wrap">
              {listing.wants.map((w) => <span key={w} className="chip chip-solid">{w}</span>)}
              {listing.openToOffers && <span className="chip chip-dashed">+ يستقبل عروض ثانية</span>}
            </div>
            <small>القيمة التقريبية: {formatSAR(listingValue(listing))} — تقدر تعرض غرض بقيمة قريبة، أو غرض وتزيد عليه مبلغ.</small>
          </div>

          <div className="detail-actions">
            {mine ? (
              <>
                <Link href="/offers" className="btn btn-primary btn-lg">شوف العروض اللي وصلتك ({offers.length})</Link>
                <button className="btn btn-ghost btn-lg" onClick={() => removeListing(listing.id).then(() => { toast('انحذف العرض'); router.push('/offers'); }).catch(() => toast('ما انحذف العرض، حاول مرة ثانية'))}>
                  <Trash2 size={17} /> حذف
                </button>
              </>
            ) : (
              <>
                <motion.button className="btn btn-primary btn-lg" whileTap={{ scale: 0.97 }} onClick={() => (authed ? setOpen(true) : router.push(`/login?next=/listing/${listing.id}`))} disabled={!!myOffer}>
                  <Repeat2 size={18} /> {myOffer ? 'أرسلت عرضك' : 'اعرض بدلك'}
                </motion.button>
                <motion.button className={`btn btn-ghost btn-lg ${fav ? 'is-fav' : ''}`} whileTap={{ scale: 0.94 }} onClick={() => toggleFav(listing.id)} aria-pressed={fav}>
                  <Heart size={17} fill={fav ? 'currentColor' : 'none'} /> {fav ? 'بالمفضلة' : 'احفظ'}
                </motion.button>
              </>
            )}
          </div>

          <div className="owner">
            <span className="avatar">{listing.ownerName.slice(0, 1)}</span>
            <div>
              <strong>{mine ? 'أنت' : listing.ownerName}</strong>
              <small><ShieldCheck size={13} /> تقابلوا في مكان عام وافحصوا قبل البدل</small>
            </div>
          </div>

          {myOffer && !mine && (
            <div className="my-offer">
              <span className="label">عرضك على هذا الغرض</span>
              <OfferRow offer={myOffer} listing={listing} role="sender" />
            </div>
          )}
        </motion.div>
      </div>

      {similar.length > 0 && (
        <section className="section">
          <h2 className="h3">عروض مشابهة</h2>
          <div className="grid">{similar.map((l, i) => <ListingCard key={l.id} listing={l} index={i} />)}</div>
        </section>
      )}

      <AnimatePresence>{open && <OfferModal listing={listing} onClose={() => setOpen(false)} />}</AnimatePresence>
    </div>
  );
}
