'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { Check, Clock, Copy, Gavel, Hourglass, Lock, MessageCircle, MessagesSquare, Trophy, Wallet, X } from 'lucide-react';
import { auctionPhase, auctionThread, formatSAR, minNextBid, parseAmount, registrationCloses, timeAgo, timeLeft, type Bid, type Listing } from '@/lib/data';
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

/** نافذة دفع رسم بتحويل بنكي: بيانات الحساب + إثبات التحويل. تُستخدم لرسم عرض المزاد ولرسم دخوله. */
function TransferModal({ title, subtitle, amount, lastStep, note, onSubmit, onClose }: {
  title: string; subtitle: string; amount: number; lastStep: string; note: string;
  onSubmit: (senderName: string, reference: string) => Promise<void>; onClose: () => void;
}) {
  const { cloud, me, toast } = useStore();
  const [senderName, setSenderName] = useState(me.name);
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  // في الوضع التجريبي نعرض حساباً وهمياً حتى تنجرّب الخطوات
  const bank = cloud ? SITE.bank : { holder: 'حساب تجريبي', bankName: 'بنك تجريبي', iban: 'SA00 0000 0000 0000 0000 0000' };
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
      await onSubmit(senderName.trim(), reference.trim());
      toast('وصلنا طلبك — نتحقق من التحويل ونفعّله');
      onClose();
    } catch {
      toast('ما انرسل الطلب — يمكن انتهى وقت التسجيل، أو الاتصال ضعيف');
      setBusy(false);
    }
  };

  return createPortal(
    <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.form
        className="modal" role="dialog" aria-modal="true" aria-label={title} onSubmit={submit} onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 60, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 40, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      >
        <div className="modal-head">
          <div>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="إغلاق"><X size={18} /></button>
        </div>

        <ol className="entry-steps">
          <li>
            حوّل <strong>{formatSAR(amount)}</strong> على الحساب:
            {bank.iban ? (
              <div className="bank">
                <span>{bank.bankName} — {bank.holder}</span>
                <button type="button" className="iban" dir="ltr" onClick={() => navigator.clipboard?.writeText(bank.iban.replace(/\s/g, '')).then(() => setCopied(true))}>
                  {bank.iban} {copied ? <Check size={15} /> : <Copy size={15} />}
                </button>
              </div>
            ) : (
              <div className="form-error">بيانات الحساب البنكي لم تُضف بعد — الدفع متوقف مؤقتاً.</div>
            )}
          </li>
          <li>اكتب بيانات تحويلك تحت عشان نطابقها.</li>
          <li>{lastStep}</li>
        </ol>

        <label className="field">
          <span className="label">اسم صاحب الحساب المحوِّل</span>
          <input className="input" value={senderName} onChange={(e) => setSenderName(e.target.value)} placeholder="مثل ما يظهر في التحويل" maxLength={80} required />
        </label>
        <label className="field">
          <span className="label">رقم العملية أو وقت التحويل (يسرّع التحقق)</span>
          <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="مثال: اليوم 9:40 م" maxLength={80} />
        </label>
        <p className="hint">{note}</p>

        <button className="btn btn-primary btn-lg btn-block" disabled={!valid || busy}>{busy ? 'جاري الإرسال…' : 'حوّلت — أرسل الطلب'}</button>
      </motion.form>
    </motion.div>,
    document.body,
  );
}

function State({ icon: Icon, title, text, tone, children }: { icon: typeof Clock; title: string; text?: string; tone?: 'won'; children?: React.ReactNode }) {
  return (
    <div className={`auction-state ${tone === 'won' ? 'is-won' : ''}`}>
      <Icon size={18} />
      <div>
        <strong>{title}</strong>
        {text && <small>{text}</small>}
        {children}
      </div>
    </div>
  );
}

/** لوحة المزاد في صفحة العرض: التفعيل، التسجيل قبل البداية، المزايدة، والنتيجة */
export default function AuctionPanel({ listing, mine }: { listing: Listing; mine: boolean }) {
  const router = useRouter();
  const { authed, me, entries, fees, unread, loadBids, placeBid, refreshListing, requestEntry, requestAuctionFee, contactFor, toast } = useStore();
  const [bids, setBids] = useState<Bid[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<'fee' | 'entry' | null>(null);
  const now = useNow();
  // العدّاد يعتمد على ساعة المتصفح، فنرسم اللوحة بعد التحميل فقط حتى لا يختلف عن نسخة الخادم
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const phase = auctionPhase(listing, now);
  const entry = entries.find((e) => e.listingId === listing.id);
  const fee = fees.find((f) => f.listingId === listing.id);
  const closesAt = registrationCloses(listing, SITE.entryCutoffMinutes);
  const canRegister = phase === 'upcoming' && now < closesAt;
  const next = minNextBid(listing);
  const amount = parseAmount(text);
  const leading = !!me.id && listing.topBidder === me.id;
  const other = mine ? listing.topBidder : listing.ownerId;
  const wa = phase === 'ended' && (mine || leading) && other ? contactFor(other)?.replace(/\D/g, '').replace(/^0/, '966') : undefined;

  const reload = useCallback(() => {
    refreshListing(listing.id).catch(() => {});
  }, [listing.id, refreshListing]);

  // نحدّث حالة المزاد كل 8 ثواني ما دام ما انتهى، ومرة عند كل تغيّر مرحلة (بدأ / انتهى)
  useEffect(() => {
    reload();
    if (phase === 'ended') return;
    const t = setInterval(reload, 8000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listing.id, phase]);

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
    reload();
    setBusy(false);
  };

  const login = () => router.push(`/login?next=/listing/${listing.id}`);

  if (!mounted) return <div className="auction"><div className="skeleton auction-skeleton" /></div>;

  // ───── قبل التفعيل: صاحب المزاد يدفع رسم العرض ─────
  if (phase === 'unpaid') {
    return (
      <div className="auction">
        <div className="auction-top">
          <div>
            <span className="label">سعر البداية</span>
            <strong className="auction-price">{formatSAR(listing.price ?? 0)}</strong>
          </div>
          <div className="countdown is-ended"><Lock size={16} /> غير مفعّل</div>
        </div>
        {!mine ? (
          <State icon={Hourglass} title="هذا المزاد ما تفعّل بعد" />
        ) : fee?.status === 'pending' ? (
          <State icon={Hourglass} title="رسم المزاد قيد التحقق" text={`نطابق تحويلك (${fee.senderName}). أول ما يتأكد، يبدأ مزادك بعد ${SITE.startDelayMinutes} دقيقة ويظهر للناس.`} />
        ) : (
          <>
            {fee?.status === 'rejected' && <div className="form-error">ما قدرنا نطابق تحويلك السابق. تأكد من البيانات وأرسل الطلب من جديد.</div>}
            <State icon={Wallet} title="مزادك محفوظ وما يظهر للناس للحين" text={`ادفع رسم عرض المزاد ${formatSAR(SITE.listingFee)}، وبعد تأكيد الدفع يبدأ المزاد بـ ${SITE.startDelayMinutes} دقيقة.`} />
            <motion.button className="btn btn-primary btn-lg btn-block" whileTap={{ scale: 0.97 }} onClick={() => setModal('fee')}>
              <Wallet size={18} /> فعّل المزاد — {formatSAR(SITE.listingFee)}
            </motion.button>
          </>
        )}
        <AnimatePresence>
          {modal === 'fee' && (
            <TransferModal
              title="تفعيل المزاد" subtitle={listing.title} amount={SITE.listingFee}
              lastStep={`نتحقق من وصول التحويل، وبعد التأكيد بـ ${SITE.startDelayMinutes} دقيقة يبدأ مزادك.`}
              note="رسم عرض المزاد ما يُسترد بعد تفعيل المزاد. التفاصيل في سياسة الإلغاء والاسترجاع."
              onSubmit={(n, r) => requestAuctionFee(listing.id, n, r)} onClose={() => setModal(null)}
            />
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="auction">
      <div className="auction-top">
        <div>
          <span className="label">{listing.currentBid ? (phase === 'ended' ? 'سعر الإغلاق' : 'أعلى مزايدة') : 'سعر البداية'}</span>
          <motion.strong key={listing.currentBid ?? 0} className="auction-price" initial={{ scale: 1.12, opacity: 0.4 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5, ease: EASE }}>
            {formatSAR(listing.currentBid ?? listing.price ?? 0)}
          </motion.strong>
        </div>
        <div className={`countdown ${phase === 'ended' ? 'is-ended' : phase === 'live' && (listing.endsAt ?? 0) - now < 600_000 ? 'is-soon' : ''}`}>
          <Clock size={16} />
          <span suppressHydrationWarning>
            {phase === 'ended' ? 'انتهى المزاد' : phase === 'upcoming' ? `يبدأ بعد ${timeLeft(listing.startsAt ?? 0, now)}` : `باقي ${timeLeft(listing.endsAt ?? 0, now)}`}
          </span>
        </div>
      </div>
      <small className="auction-meta">
        {listing.bidsCount ?? 0} مزايدة · أقل زيادة {formatSAR(listing.minIncrement ?? 10)} · رسم الدخول {formatSAR(SITE.auctionFee)}
        {phase === 'upcoming' && listing.durationMinutes ? ` · مدة المزاد ${listing.durationMinutes >= 60 ? `${listing.durationMinutes / 60} ساعة` : `${listing.durationMinutes} دقيقة`}` : ''}
      </small>

      {phase === 'ended' ? (
        <State
          icon={Trophy} tone={listing.topBidder ? 'won' : undefined}
          title={!listing.topBidder ? 'انتهى المزاد بدون مزايدات' : leading ? 'مبروك! أنت الفائز بالمزاد' : mine ? `الفائز: ${bids[0]?.bidderName ?? 'صاحب أعلى مزايدة'}` : 'انتهى المزاد وفاز صاحب أعلى مزايدة'}
        >
          {(mine || leading) && listing.topBidder && (
            <div className="offer-actions">
              <Link className="btn btn-primary btn-sm chat-link" href={`/chat/${auctionThread(listing.id)}`}>
                <MessagesSquare size={15} /> {unread.includes(auctionThread(listing.id)) ? 'رسالة جديدة' : 'المحادثة'}
                {unread.includes(auctionThread(listing.id)) && <span className="dot" aria-hidden />}
              </Link>
              {wa && <a className="btn btn-ghost btn-sm" href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer"><MessageCircle size={15} /> واتساب</a>}
            </div>
          )}
        </State>
      ) : mine ? (
        <State icon={Gavel} title="هذا مزادك" text={phase === 'upcoming' ? 'المزاد مفعّل وظاهر للناس. المزايدون يسجّلون الحين، والمزايدة تبدأ مع نهاية العدّاد.' : 'تابع المزايدات هنا. بعد انتهائه يظهر لك رقم الفائز.'} />
      ) : entry?.status === 'approved' && phase === 'live' ? (
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
      ) : entry?.status === 'approved' ? (
        <State icon={Check} tone="won" title="دخولك مفعّل" text={`المزايدة تفتح لك بعد ${timeLeft(listing.startsAt ?? 0, now)}. خلّك في الصفحة.`} />
      ) : entry?.status === 'pending' ? (
        <State icon={Hourglass} title="طلب دخولك قيد التحقق" text={`نطابق تحويلك (${entry.senderName}) ونفعّل دخولك. بيوصلك تنبيه هنا.`} />
      ) : canRegister ? (
        <>
          {entry?.status === 'rejected' && <div className="form-error">ما قدرنا نطابق تحويلك السابق. تأكد من البيانات وأرسل الطلب من جديد.</div>}
          <motion.button className="btn btn-primary btn-lg btn-block" whileTap={{ scale: 0.97 }} onClick={() => (authed ? setModal('entry') : login())}>
            <Gavel size={18} /> ادخل المزاد — {formatSAR(SITE.auctionFee)}
          </motion.button>
          <p className="hint" suppressHydrationWarning>
            التسجيل يقفل بعد <strong>{timeLeft(closesAt, now)}</strong> (قبل بداية المزاد بـ {SITE.entryCutoffMinutes} دقايق). بعدها ما تقدر تدفع الرسم ولا تشارك.
          </p>
        </>
      ) : (
        <State icon={Lock} title="التسجيل في هذا المزاد مقفل" text={`الدخول ينقفل قبل بداية المزاد بـ ${SITE.entryCutoffMinutes} دقايق، والمزايدة للمسجّلين فقط. تقدر تتابع المزايدات هنا.`} />
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

      <AnimatePresence>
        {modal === 'entry' && (
          <TransferModal
            title="دخول المزاد" subtitle={listing.title} amount={SITE.auctionFee}
            lastStep="نتحقق من وصول التحويل ونفعّل دخولك، وتقدر تزايد أول ما يبدأ المزاد."
            note="الرسم يخص هذا المزاد فقط، وما يُسترد بعد تفعيل الدخول. التفاصيل في سياسة الإلغاء والاسترجاع."
            onSubmit={(n, r) => requestEntry(listing.id, n, r)} onClose={() => setModal(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
