'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, MessageCircle, SendHorizontal, ShieldCheck } from 'lucide-react';
import { ListingArt } from '@/components/ui';
import { auctionEnded, formatSAR, parseThread, type Message } from '@/lib/data';
import { useStore } from '@/lib/store';

const clock = (ts: number) => new Date(ts).toLocaleTimeString('ar-SA-u-nu-latn', { hour: 'numeric', minute: '2-digit' });
const day = (ts: number) => {
  const d = new Date(ts), now = new Date();
  if (d.toDateString() === now.toDateString()) return 'اليوم';
  if (d.toDateString() === new Date(now.getTime() - 86_400_000).toDateString()) return 'أمس';
  return d.toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { day: 'numeric', month: 'long' });
};

/** محادثة بين طرفي اتفاق: عرض مقبول (o-…) أو مزاد منتهٍ بين صاحبه والفائز (a-…) */
export default function ChatPage({ params }: { params: { id: string } }) {
  const thread = decodeURIComponent(params.id);
  const { ready, authed, me, all, offers, chatHeads, loadMessages, sendMessage, markRead, loadBids, contactFor, toast } = useStore();
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [winner, setWinner] = useState('');
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setWaited(true), 3500);
    return () => clearTimeout(timer);
  }, []);
  const boxRef = useRef<HTMLDivElement>(null);

  // أطراف المحادثة من بيانات العرض أو المزاد
  const t = parseThread(thread);
  const offer = t.kind === 'offer' ? offers.find((o) => o.id === t.id) : undefined;
  const listing = all.find((l) => l.id === (offer ? offer.listingId : t.id));
  const iOwn = !!listing && listing.ownerId === me.id;
  const allowed = t.kind === 'offer'
    ? !!offer && offer.status === 'accepted'
    : !!listing && listing.kind === 'auction' && auctionEnded(listing) && !!listing.topBidder && (iOwn || listing.topBidder === me.id);
  const otherId = t.kind === 'offer' ? (iOwn ? offer?.fromId : listing?.ownerId) : iOwn ? listing?.topBidder : listing?.ownerId;
  const otherName = t.kind === 'offer' ? (iOwn ? offer?.fromName : listing?.ownerName) : iOwn ? winner || 'الفائز بالمزاد' : listing?.ownerName;
  const wa = otherId && !offer?.demo ? contactFor(otherId)?.replace(/\D/g, '').replace(/^0/, '966') : undefined;
  const subject = !listing ? '' : t.kind === 'auction' ? `فاز بـ ${formatSAR(listing.currentBid ?? 0)}`
    : offer?.kind === 'buy' ? `طلب شراء بـ ${formatSAR(offer.cash ?? 0)}` : `عرض بدل: ${offer?.itemTitle ?? ''}`;

  useEffect(() => {
    if (t.kind === 'auction' && iOwn) loadBids(t.id).then((b) => setWinner(b[0]?.bidderName ?? '')).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.kind, t.id, iOwn]);

  const reload = useCallback(() => {
    loadMessages(thread).then(setMessages).catch(() => setMessages((m) => m ?? []));
  }, [loadMessages, thread]);

  // نحمّل الرسائل عند الفتح، كل 4 ثواني، وكل ما وصل تنبيه برسالة جديدة في هذه المحادثة
  const lastAt = chatHeads[thread]?.lastAt;
  useEffect(() => {
    if (!allowed) return;
    reload();
    const timer = setInterval(() => document.visibilityState === 'visible' && reload(), 4000);
    return () => clearInterval(timer);
  }, [allowed, reload, lastAt]);

  // ننزل لآخر رسالة ونعلّم المحادثة مقروءة
  const count = messages?.length ?? 0;
  useEffect(() => {
    if (!count) return;
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight, behavior: 'smooth' });
    markRead(thread);
  }, [count, thread, markRead]);
  useEffect(() => {
    if (allowed) markRead(thread);
  }, [allowed, thread, markRead, lastAt]);

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      await sendMessage(thread, body);
      setText('');
      // نعرض الرسالة فوراً؛ التحميل التالي (يتبع تنبيه الرسالة الجديدة) يستبدلها بالنسخة المحفوظة
      setMessages((m) => [...(m ?? []), { id: `tmp-${Date.now()}`, thread, senderId: me.id, body, createdAt: Date.now() }]);
    } catch {
      toast('ما انرسلت الرسالة، حاول مرة ثانية');
    }
    setBusy(false);
  };

  // بيانات العروض توصل بعد لحظات من فتح الصفحة، فننتظر قبل ما نحكم إن المحادثة غير متاحة
  if (!ready || (authed && !allowed && !waited)) {
    return <div className="container page page-narrow"><div className="skeleton" /></div>;
  }
  if (!authed) {
    return (
      <div className="container page page-narrow empty">
        <h1 className="h2">سجّل دخولك</h1>
        <p className="lead">عشان تفتح محادثاتك.</p>
        <Link href={`/login?next=/chat/${thread}`} className="btn btn-primary btn-lg">دخول</Link>
      </div>
    );
  }
  if (!allowed) {
    return (
      <div className="container page page-narrow empty">
        <h1 className="h2">المحادثة غير متاحة</h1>
        <p className="lead">المحادثة تنفتح بين الطرفين بعد قبول العرض، أو بين صاحب المزاد والفائز بعد انتهائه.</p>
        <Link href="/offers" className="btn btn-primary btn-lg">عروضي</Link>
      </div>
    );
  }

  let lastDay = '';
  return (
    <div className="container page page-narrow">
      <Link href="/offers" className="back"><ArrowRight size={16} /> عروضي</Link>

      <div className="chat">
        <header className="chat-head">
          <Link href={`/listing/${listing!.id}`} className="chat-thumb"><ListingArt listing={listing!} iconSize={22} /></Link>
          <div className="chat-who">
            <strong>{otherName}</strong>
            <small>{listing!.title} · {subject}</small>
          </div>
          {wa && <a className="btn btn-ghost btn-sm" href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer"><MessageCircle size={15} /> واتساب</a>}
        </header>

        <div className="chat-body" ref={boxRef} role="log" aria-live="polite" aria-label="الرسائل">
          <p className="chat-safety"><ShieldCheck size={14} /> تقابلوا في مكان عام وافحصوا قبل التسليم، ولا تحوّل أي مبلغ قبل ما تستلم.</p>
          {messages === null ? <div className="skeleton chat-skeleton" /> : messages.length === 0 ? (
            <p className="chat-empty">ما فيه رسائل للحين. ابدأ ورتّب مع {otherName} مكان ووقت اللقاء.</p>
          ) : (
            <AnimatePresence initial={false}>
              {messages.map((m) => {
                const d = day(m.createdAt), showDay = d !== lastDay;
                lastDay = d;
                const mine = m.senderId === me.id;
                return (
                  <motion.div key={m.id} className="msg-wrap" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                    {showDay && <span className="chat-day" suppressHydrationWarning>{d}</span>}
                    <div className={`msg ${mine ? 'is-mine' : ''}`}>
                      <p>{m.body}</p>
                      <small suppressHydrationWarning>{clock(m.createdAt)}{m.demo ? ' · تجريبي' : ''}</small>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>

        <form className="chat-form" onSubmit={send}>
          <textarea
            className="input" rows={1} value={text} maxLength={1000} placeholder="اكتب رسالتك…" aria-label="رسالة"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }}
          />
          <motion.button className="btn btn-primary chat-send" whileTap={{ scale: 0.94 }} disabled={!text.trim() || busy} aria-label="إرسال"><SendHorizontal size={19} /></motion.button>
        </form>
      </div>
    </div>
  );
}
