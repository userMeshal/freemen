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

/** محادثة بين صاحب إعلان وأي مستخدم مهتم به — متاحة من أول سؤال، دون انتظار قبول عرض */
export default function ChatPage({ params }: { params: { id: string } }) {
  const thread = decodeURIComponent(params.id);
  const { ready, authed, me, all, offers, chatHeads, loadMessages, sendMessage, markRead, peerName, contactFor, toast } = useStore();
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [fetched, setFetched] = useState<string>();
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setWaited(true), 3500);
    return () => clearTimeout(timer);
  }, []);
  const boxRef = useRef<HTMLDivElement>(null);

  // طرفا المحادثة: صاحب الإعلان والطرف المهتم (peer)
  const t = parseThread(thread);
  const listing = all.find((l) => l.id === t.listingId);
  const iOwn = !!listing && listing.ownerId === me.id;
  const allowed = !!listing && !!me.id && !!t.peerId && (iOwn ? t.peerId !== me.id : t.peerId === me.id);
  const offer = offers.find((o) => o.listingId === t.listingId && o.fromId === t.peerId);
  const otherId = iOwn ? t.peerId : listing?.ownerId;
  const otherName = iOwn ? offer?.fromName ?? chatHeads[thread]?.peerName ?? fetched ?? '…' : listing?.ownerName;
  // رقم الواتساب تحجبه القاعدة حتى يُقبل عرض بين الطرفين، فالزر يظهر بعدها فقط
  const wa = otherId && !offer?.demo ? contactFor(otherId)?.replace(/\D/g, '').replace(/^0/, '966') : undefined;
  const subject = !listing ? ''
    : offer?.status === 'accepted' ? (offer.kind === 'buy' ? `طلب شراء مقبول بـ ${formatSAR(offer.cash ?? 0)}` : 'عرض بدل مقبول')
    : listing.kind === 'sale' ? `للبيع بـ ${formatSAR(listing.price ?? 0)}`
    : listing.kind === 'auction' ? (auctionEnded(listing) ? `مزاد انتهى${listing.currentBid ? ` بـ ${formatSAR(listing.currentBid)}` : ''}` : 'مزاد')
    : 'للبدل';

  useEffect(() => {
    if (iOwn && t.peerId && !offer) peerName(t.peerId).then(setFetched).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iOwn, t.peerId, !!offer]);

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
      toast(iOwn ? 'ما انرسلت الرسالة — تقدر ترد على من راسلك أو قدّم عرضاً على إعلانك' : 'ما انرسلت الرسالة، حاول مرة ثانية');
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
        <p className="lead">يمكن الإعلان انحذف، أو هذي محادثة ما تخصّك.</p>
        <Link href="/browse" className="btn btn-primary btn-lg">تصفّح السوق</Link>
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
            <p className="chat-empty">{iOwn ? `ما فيه رسائل للحين مع ${otherName}.` : `اسأل ${otherName} عن الغرض: حالته، مكانه، أو أي تفصيل يهمّك.`}</p>
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
