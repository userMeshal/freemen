'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, RefreshCw, X } from 'lucide-react';
import { formatSAR, timeAgo, type Entry } from '@/lib/data';
import { SITE } from '@/lib/site';
import { useStore } from '@/lib/store';

/** لوحة المشرف: مطابقة تحويلات رسم دخول المزاد وتفعيل المزايدين */
export default function AdminPage() {
  const { ready, isAdmin, loadPendingEntries, reviewEntry, toast } = useStore();
  const [list, setList] = useState<Entry[] | null>(null);
  const [busy, setBusy] = useState('');

  const load = useCallback(() => {
    loadPendingEntries().then(setList).catch(() => toast('ما قدرنا نحمّل الطلبات'));
  }, [loadPendingEntries, toast]);

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
          <h1 className="h2">طلبات دخول المزادات</h1>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={15} /> تحديث</button>
      </header>
      <p className="lead admin-lead">
        طابق كل طلب مع كشف حسابك البنكي: تحويل بـ {formatSAR(SITE.auctionFee)} من نفس الاسم. فعّل الدخول بعد ما تتأكد من وصول المبلغ فقط.
      </p>

      {list === null ? <div className="skeleton" /> : list.length === 0 ? (
        <div className="empty"><h3>ما فيه طلبات تنتظر</h3><p>كل الطلبات انراجعت.</p></div>
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
