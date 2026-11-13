'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, RefreshCw, X } from 'lucide-react';
import { formatSAR, timeAgo, type Entry, type Fee } from '@/lib/data';
import { SITE } from '@/lib/site';
import { useStore } from '@/lib/store';

/** لوحة المشرف: مطابقة تحويلات رسم دخول المزاد وتفعيل المزايدين */
export default function AdminPage() {
  const { ready, isAdmin, loadPendingEntries, reviewEntry, loadPendingFees, reviewFee, toast } = useStore();
  const [list, setList] = useState<Entry[] | null>(null);
  const [fees, setFees] = useState<Fee[] | null>(null);
  const [busy, setBusy] = useState('');

  const load = useCallback(() => {
    loadPendingEntries().then(setList).catch(() => toast('ما قدرنا نحمّل الطلبات'));
    loadPendingFees().then(setFees).catch(() => toast('ما قدرنا نحمّل رسوم المزادات'));
  }, [loadPendingEntries, loadPendingFees, toast]);

  const decideFee = async (listingId: string, approve: boolean) => {
    setBusy(listingId);
    try {
      await reviewFee(listingId, approve);
      setFees((l) => (l ?? []).filter((f) => f.listingId !== listingId));
      toast(approve ? `تفعّل المزاد — يبدأ بعد ${SITE.startDelayMinutes} دقيقة` : 'انرفض الطلب');
    } catch {
      toast('ما انحفظ القرار، حاول مرة ثانية');
    }
    setBusy('');
  };

  useEffect(() => {
    if (isAdmin) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const decide = async (id: string, status: 'approved' | 'rejected') => {
    setBusy(id);
    try {
      await reviewEntry(id, status);
      setList((l) => (l ?? []).filter((e) => e.id !== id));
      toast(status === 'approved' ? 'تفعّل دخول المزايد' : 'انرفض الطلب');
    } catch {
      toast('ما انحفظ القرار، حاول مرة ثانية');
    }
    setBusy('');
  };

  if (!ready) return <div className="container page"><div className="skeleton" /></div>;
  if (!isAdmin) {
    return (
      <div className="container page page-narrow empty">
        <h1 className="h2">هذي الصفحة للإدارة</h1>
        <p className="lead">ما عندك صلاحية تشوفها.</p>
        <Link href="/" className="btn btn-primary btn-lg">الرئيسية</Link>
      </div>
    );
  }

  return (
    <div className="container page page-narrow">
      <header className="page-head account-head">
        <div>
          <span className="eyebrow">الإدارة</span>
          <h1 className="h2">تحويلات المزادات</h1>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={15} /> تحديث</button>
      </header>
      <p className="lead admin-lead">
        طابق كل طلب مع كشف حسابك البنكي بالاسم والمبلغ، وفعّل بعد ما تتأكد من وصول المبلغ فقط. طلبات الدخول مستعجلة: المزايد ما يقدر يزايد لين تفعّله.
      </p>

      <h2 className="h3 admin-h">رسوم عرض المزادات — {formatSAR(SITE.listingFee)}</h2>
      {fees === null ? <div className="skeleton" /> : fees.length === 0 ? (
        <p className="hint admin-none">ما فيه مزادات تنتظر التفعيل.</p>
      ) : (
        <AnimatePresence initial={false}>
          {fees.map((f) => (
            <motion.div layout key={f.listingId} className="offer" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 40 }}>
              <div className="offer-main">
                <div className="offer-top"><strong>{f.senderName}</strong><span className="status">اسم المحوِّل</span></div>
                <div className="offer-sub">
                  <span>الحساب: {f.ownerName ?? '—'}</span>
                  <Link href={`/listing/${f.listingId}`}>المزاد: {f.listingTitle ?? f.listingId.slice(0, 8)}</Link>
                  <span suppressHydrationWarning>{timeAgo(f.createdAt)}</span>
                </div>
                {f.reference && <p className="offer-note">المرجع: {f.reference}</p>}
                <div className="offer-actions">
                  <button className="btn btn-primary btn-sm" disabled={busy === f.listingId} onClick={() => decideFee(f.listingId, true)}><Check size={15} /> وصل التحويل — فعّل المزاد</button>
                  <button className="btn btn-ghost btn-sm" disabled={busy === f.listingId} onClick={() => decideFee(f.listingId, false)}><X size={15} /> ما وصل — ارفض</button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      )}

      <h2 className="h3 admin-h">طلبات دخول المزادات — {formatSAR(SITE.auctionFee)}</h2>

      {list === null ? <div className="skeleton" /> : list.length === 0 ? (
        <p className="hint admin-none">ما فيه طلبات دخول تنتظر.</p>
      ) : (
        <AnimatePresence initial={false}>
          {list.map((e) => (
            <motion.div layout key={e.id} className="offer" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 40 }}>
              <div className="offer-main">
                <div className="offer-top"><strong>{e.senderName}</strong><span className="status">اسم المحوِّل</span></div>
                <div className="offer-sub">
                  <span>الحساب: {e.userName ?? '—'}</span>
                  <Link href={`/listing/${e.listingId}`}>المزاد: {e.listingTitle ?? e.listingId.slice(0, 8)}</Link>
                  <span suppressHydrationWarning>{timeAgo(e.createdAt)}</span>
                </div>
                {e.reference && <p className="offer-note">المرجع: {e.reference}</p>}
                <div className="offer-actions">
                  <button className="btn btn-primary btn-sm" disabled={busy === e.id} onClick={() => decide(e.id, 'approved')}><Check size={15} /> وصل التحويل — فعّل</button>
                  <button className="btn btn-ghost btn-sm" disabled={busy === e.id} onClick={() => decide(e.id, 'rejected')}><X size={15} /> ما وصل — ارفض</button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      )}
    </div>
  );
}
