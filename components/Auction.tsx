'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Clock, Copy, Gavel, Hourglass, MessageCircle, Trophy, X } from 'lucide-react';
import { auctionEnded, formatSAR, minNextBid, parseAmount, timeAgo, timeLeft, type Bid, type Listing } from '@/lib/data';
import { SITE } from '@/lib/site';
import { useStore } from '@/lib/store';
import { EASE } from './ui';

/** عدّاد يتحدث كل ثانية */
export function useNow(active = true) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

/** نافذة دخول المزاد: بيانات التحويل البنكي + إثبات التحويل */
function EntryModal({ listing, onClose }: { listing: Listing; onClose: () => void }) {
  const { cloud, me, requestEntry, toast } = useStore();
  const [senderName, setSenderName] = useState(me.name);
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  // في الوضع التجريبي نعرض حساباً وهمياً حتى تنجرّب الخطوات
  const bank = SITE.bank.iban || cloud ? SITE.bank : { holder: 'حساب تجريبي', bankName: 'بنك تجريبي', iban: 'SA00 0000 0000 0000 0000 0000' };
  const valid = senderName.trim().length > 1 && !!bank.iban;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    try {
      await requestEntry(listing.id, senderName.trim(), reference.trim());
      toast('وصلنا طلبك — نفعّل دخولك بعد التحقق من التحويل');
      onClose();
    } catch {
      toast('ما انرسل الطلب، حاول مرة ثانية');
      setBusy(false);
    }
  };

  return createPortal(
    <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.form
        className="modal" role="dialog" aria-modal="true" aria-label="دخول المزاد" onSubmit={submit} onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 60, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 40, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      >
        <div className="modal-head">
          <div>
            <h2>دخول المزاد</h2>
            <p>{listing.title}</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="إغلاق"><X size={18} /></button>
        </div>

        <ol className="entry-steps">
          <li>
            حوّل <strong>{formatSAR(SITE.auctionFee)}</strong> رسم الدخول على الحساب:
            {bank.iban ? (
              <div className="bank">
                <span>{bank.bankName} — {bank.holder}</span>
                <button type="button" className="iban" dir="ltr" onClick={() => navigator.clipboard?.writeText(bank.iban.replace(/\s/g, '')).then(() => setCopied(true))}>
                  {bank.iban} {copied ? <Check size={15} /> : <Copy size={15} />}
                </button>
              </div>
            ) : (
              <div className="form-error">بيانات الحساب البنكي لم تُضف بعد — دخول المزادات متوقف مؤقتاً.</div>
            )}
          </li>
          <li>اكتب بيانات تحويلك تحت عشان نطابقها.</li>
          <li>نتحقق من وصول التحويل ونفعّل دخولك، وبعدها تقدر تزايد.</li>
        </ol>

        <label className="field">
          <span className="label">اسم صاحب الحساب المحوِّل</span>
          <input className="input" value={senderName} onChange={(e) => setSenderName(e.target.value)} placeholder="مثل ما يظهر في التحويل" maxLength={80} required />
        </label>
        <label className="field">
          <span className="label">رقم العملية أو وقت التحويل (يسرّع التحقق)</span>
          <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="مثال: اليوم 9:40 م" maxLength={80} />
        </label>
        <p className="hint">الرسم يخص هذا المزاد فقط، وما يُسترد بعد تفعيل الدخول. التفاصيل في سياسة الإلغاء والاسترجاع.</p>

        <button className="btn btn-primary btn-lg btn-block" disabled={!valid || busy}>{busy ? 'جاري الإرسال…' : 'حوّلت — أرسل الطلب'}</button>
      </motion.form>
    </motion.div>,
    document.body,
  );
}

/** لوحة المزاد في صفحة العرض: السعر الحالي، العدّاد، المزايدة، وسجل المزايدات */
export default function AuctionPanel({ listing, mine }: { listing: Listing; mine: boolean }) {
  const router = useRouter();
  const { authed, me, entries, loadBids, placeBid, refreshListing, contactFor, toast } = useStore();
  const [bids, setBids] = useState<Bid[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const now = useNow();

  const ended = auctionEnded(listing, now);
  const entry = entries.find((e) => e.listingId === listing.id);
  const next = minNextBid(listing);
  const amount = parseAmount(text);
  const leading = !!me.id && listing.topBidder === me.id;
  const other = mine ? listing.topBidder : listing.ownerId;
  const wa = ended && (mine || leading) && other ? contactFor(other)?.replace(/\D/g, '').replace(/^0/, '966') : undefined;

  const reload = useCallback(() => {
    loadBids(listing.id).then(setBids).catch(() => {});
    refreshListing(listing.id).catch(() => {});
  }, [listing.id, loadBids, refreshListing]);

  // نحدّث السعر والمزايدات كل 8 ثواني ما دام المزاد شغّال، ومرة عند انتهائه
  useEffect(() => {
    reload();
    if (ended) return;
    const t = setInterval(reload, 8000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listing.id, ended]);

  // سجل المزايدات يتبع السعر: أي مزايدة جديدة (مني أو من غيري) تحدّثه
  useEffect(() => {
    loadBids(listing.id).then(setBids).catch(() => {});
  }, [listing.id, listing.currentBid, listing.bidsCount, loadBids]);

  const bid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || amount < next) return;
    setBusy(true);
    setError('');
    const err = await placeBid(listing.id, amount);
    if (err) setError(err);
    else {
      setText('');
      toast('انحسبت مزايدتك — أنت الأعلى الحين');
    }
    // السعر يتحدث من القاعدة، وسجل المزايدات يتبعه تلقائياً
    refreshListing(listing.id).catch(() => {});
    setBusy(false);
  };

  return (
    <div className="auction">
      <div className="auction-top">
        <div>
          <span className="label">{listing.currentBid ? (ended ? 'سعر الإغلاق' : 'أعلى مزايدة') : 'سعر البداية'}</span>
          <motion.strong key={listing.currentBid ?? 0} className="auction-price" initial={{ scale: 1.12, opacity: 0.4 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5, ease: EASE }}>
            {formatSAR(listing.currentBid ?? listing.price ?? 0)}
          </motion.strong>
        </div>
        <div className={`countdown ${ended ? 'is-ended' : (listing.endsAt ?? 0) - now < 3600_000 ? 'is-soon' : ''}`}>
          <Clock size={16} />
          <span suppressHydrationWarning>{ended ? 'انتهى المزاد' : `باقي ${timeLeft(listing.endsAt ?? 0, now)}`}</span>
        </div>
      </div>
      <small className="auction-meta">{listing.bidsCount ?? 0} مزايدة · أقل زيادة {formatSAR(listing.minIncrement ?? 10)} · رسم الدخول {formatSAR(SITE.auctionFee)}</small>

      {ended ? (
        <div className={`auction-state ${listing.topBidder ? 'is-won' : ''}`}>
          <Trophy size={18} />
          <div>
            <strong>{!listing.topBidder ? 'انتهى المزاد بدون مزايدات' : leading ? 'مبروك! أنت الفائز بالمزاد' : mine ? `الفائز: ${bids[0]?.bidderName ?? 'صاحب أعلى مزايدة'}` : 'انتهى المزاد وفاز صاحب أعلى مزايدة'}</strong>
            {(mine || leading) && listing.topBidder && (
              wa ? <a className="btn btn-primary btn-sm" href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer"><MessageCircle size={15} /> تواصل واتساب</a>
                : <small>رتّبوا التسليم والدفع بينكم مباشرة. الطرف الثاني ما أضاف رقم واتساب.</small>
            )}
          </div>
        </div>
      ) : mine ? (
        <div className="auction-state"><Gavel size={18} /><div><strong>هذا مزادك</strong><small>تابع المزايدات هنا. بعد انتهائه يظهر لك رقم الفائز.</small></div></div>
      ) : entry?.status === 'approved' ? (
        <form onSubmit={bid}>
          {leading && <p className="leading"><Check size={15} /> أنت صاحب أعلى مزايدة الحين</p>}
          <div className="bid-row">
            <input className="input" dir="ltr" inputMode="numeric" value={text} onChange={(e) => { setText(e.target.value); setError(''); }} placeholder={`${next.toLocaleString('en-US')} أو أكثر`} aria-label="مبلغ المزايدة" />
            <motion.button className="btn btn-primary btn-lg" whileTap={{ scale: 0.97 }} disabled={busy || amount < next}><Gavel size={18} /> زاوِد</motion.button>
          </div>
          <div className="chips chips-wrap quick-bids">
            {[0, 1, 4].map((k) => {
              const v = next + k * (listing.minIncrement ?? 10);
              return <button type="button" key={k} className="chip chip-btn" onClick={() => { setText(String(v)); setError(''); }}>{formatSAR(v)}</button>;
            })}
          </div>
          {error && <div className="form-error" role="alert">{error}</div>}
          <p className="hint">المزايدة ملزمة وما تنسحب. لو فزت، تدفع المبلغ لصاحب الغرض مباشرة عند الاستلام.</p>
        </form>
      ) : entry?.status === 'pending' ? (
        <div className="auction-state"><Hourglass size={18} /><div><strong>طلب دخولك قيد التحقق</strong><small>نطابق تحويلك ({entry.senderName}) ونفعّل دخولك. بيوصلك تنبيه هنا.</small></div></div>
      ) : (
        <>
          {entry?.status === 'rejected' && <div className="form-error">ما قدرنا نطابق تحويلك السابق. تأكد من البيانات وأرسل الطلب من جديد.</div>}
          <motion.button className="btn btn-primary btn-lg btn-block" whileTap={{ scale: 0.97 }} onClick={() => (authed ? setOpen(true) : router.push(`/login?next=/listing/${listing.id}`))}>
            <Gavel size={18} /> ادخل المزاد — {formatSAR(SITE.auctionFee)}
          </motion.button>
          <p className="hint">رسم الدخول يُدفع بتحويل بنكي مرة واحدة لهذا المزاد، وبعد التحقق تقدر تزايد.</p>
        </>
      )}

      {bids.length > 0 && (
        <div className="bid-list">
          <span className="label">آخر المزايدات</span>
          <AnimatePresence initial={false}>
            {bids.slice(0, 6).map((b, i) => (
              <motion.div layout key={b.id} className={`bid ${i === 0 ? 'is-top' : ''}`} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
                <span>{b.bidderId === me.id ? 'أنت' : b.bidderName}</span>
                <small suppressHydrationWarning>{timeAgo(b.createdAt)}</small>
                <strong>{formatSAR(b.amount)}</strong>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>{open && <EntryModal listing={listing} onClose={() => setOpen(false)} />}</AnimatePresence>
    </div>
  );
}
