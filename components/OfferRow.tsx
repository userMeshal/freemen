'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Check, MessageCircle, Repeat2, ShoppingBag, X } from 'lucide-react';
import { fairness, formatSAR, listingValue, offerValue, timeAgo, type Listing, type Offer } from '@/lib/data';
import { useStore } from '@/lib/store';
import { CategoryIcon, EASE } from './ui';

const STATUS = { pending: 'بانتظار الرد', accepted: 'تم القبول', rejected: 'مرفوض' } as const;

export default function OfferRow({ offer, listing, role }: { offer: Offer; listing?: Listing; role: 'owner' | 'sender' }) {
  const { setOfferStatus, withdrawOffer, toast, contactFor } = useStore();
  const buy = offer.kind === 'buy';
  const f = listing && !buy ? fairness(listingValue(listing), offerValue(offer)) : null;
  const diff = buy && listing?.price ? (offer.cash ?? 0) - listing.price : 0;
  const other = role === 'sender' ? listing?.ownerId : offer.fromId;
  const wa = (other ? contactFor(other) : undefined)?.replace(/\D/g, '').replace(/^0/, '966');
  const decide = (status: 'accepted' | 'rejected') =>
    setOfferStatus(offer.id, status)
      .then(() => status === 'accepted' && toast(buy ? 'تم قبول طلب الشراء' : 'مبروك! تم الاتفاق على البدل'))
      .catch(() => toast('ما قدرنا نحفظ ردّك، حاول مرة ثانية'));

  return (
    <motion.div
      layout
      className={`offer offer-${offer.status}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ duration: 0.5, ease: EASE }}
    >
      <div className="offer-thumb">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {offer.image ? <img src={offer.image} alt="" /> : buy ? <ShoppingBag size={24} strokeWidth={1.4} /> : <CategoryIcon id={offer.itemCategory} size={24} strokeWidth={1.4} />}
      </div>
      <div className="offer-main">
        <div className="offer-top">
          <strong>{buy ? `طلب شراء بـ ${formatSAR(offer.cash ?? 0)}` : offer.itemTitle}</strong>
          {!buy && !!offer.cash && <span className="cash-chip">+ {formatSAR(offer.cash)}</span>}
          <span className={`status status-${offer.status}`}>{STATUS[offer.status]}</span>
          {offer.demo && <span className="status status-demo">تجريبي</span>}
        </div>
        <div className="offer-sub">
          {role === 'owner' ? <span>من {offer.fromName}</span> : listing && <Link href={`/listing/${listing.id}`}><Repeat2 size={13} /> مقابل {listing.title}</Link>}
          {!buy && <span>{offer.itemCondition}</span>}
          {buy && listing?.price != null && <span className={`fair-tag fair-${diff >= 0 ? 2 : 1}`}>{diff === 0 ? 'بالسعر المطلوب' : diff > 0 ? `أعلى بـ ${formatSAR(diff)}` : `أقل بـ ${formatSAR(-diff)}`}</span>}
          {f && <span className={`fair-tag fair-${f.level}`}>{f.label}</span>}
          <span suppressHydrationWarning>{timeAgo(offer.createdAt)}</span>
        </div>
        {offer.note && <p className="offer-note">«{offer.note}»</p>}

        {role === 'owner' && offer.status === 'pending' && (
          <div className="offer-actions">
            <motion.button whileTap={{ scale: 0.95 }} className="btn btn-primary btn-sm" onClick={() => decide('accepted')}>
              <Check size={15} /> {buy ? 'اقبل الطلب' : 'اقبل البدل'}
            </motion.button>
            <motion.button whileTap={{ scale: 0.95 }} className="btn btn-ghost btn-sm" onClick={() => decide('rejected')}>
              <X size={15} /> ارفض
            </motion.button>
          </div>
        )}

        {role === 'sender' && offer.status === 'pending' && (
          <div className="offer-actions">
            <motion.button whileTap={{ scale: 0.95 }} className="btn btn-ghost btn-sm"
              onClick={() => withdrawOffer(offer.id).then(() => toast('انسحب عرضك')).catch(() => toast('ما انسحب العرض، حاول مرة ثانية'))}>
              <X size={15} /> {buy ? 'اسحب الطلب' : 'اسحب العرض'}
            </motion.button>
          </div>
        )}

        {offer.status === 'accepted' && (
          <motion.div className="offer-deal" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
            {wa && !offer.demo ? (
              <a className="btn btn-primary btn-sm" href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer"><MessageCircle size={15} /> تواصل واتساب</a>
            ) : (
              <span className="deal-hint"><MessageCircle size={14} /> تم الاتفاق — {offer.demo ? 'رتّبوا مكان ووقت اللقاء وسلّموا يد بيد.' : 'الطرف الثاني ما أضاف رقم واتساب للحين.'}</span>
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
