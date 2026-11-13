'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, RefreshCw, Search, ShieldCheck, Trash2, UserPlus, X } from 'lucide-react';
import { ListingArt } from '@/components/ui';
import { KINDS, formatSAR, timeAgo, REPORT_REASONS, type Admin, type Entry, type Fee, type Listing, type Report } from '@/lib/data';
import { SITE } from '@/lib/site';
import { useStore } from '@/lib/store';

/** لوحة المشرف: تحويلات المزادات، حذف الإعلانات المخالفة، وإدارة المشرفين (للمشرف الأساسي) */
export default function AdminPage() {
  const { ready, isAdmin, isRootAdmin, all, me, loadPendingEntries, reviewEntry, loadPendingFees, reviewFee, loadAdmins, addAdmin, removeAdmin, adminDeleteListing, loadReports, resolveReport, toast } = useStore();
  const [reports, setReports] = useState<Report[] | null>(null);
  const [admins, setAdmins] = useState<Admin[] | null>(null);
  const [mail, setMail] = useState('');
  const [q, setQ] = useState('');
  const [doomed, setDoomed] = useState<Listing | null>(null);
  const [reason, setReason] = useState('');
  const [list, setList] = useState<Entry[] | null>(null);
  const [fees, setFees] = useState<Fee[] | null>(null);
  const [busy, setBusy] = useState('');

  const load = useCallback(() => {
    loadPendingEntries().then(setList).catch(() => toast('ما قدرنا نحمّل الطلبات'));
    loadPendingFees().then(setFees).catch(() => toast('ما قدرنا نحمّل رسوم المزادات'));
    loadReports().then(setReports).catch(() => setReports([]));
  }, [loadPendingEntries, loadPendingFees, loadReports, toast]);

  const closeReport = async (id: string) => {
    setBusy(id);
    try {
      await resolveReport(id);
      setReports((l) => (l ?? []).filter((r) => r.id !== id));
      toast('انقفل البلاغ');
    } catch {
      toast('ما انحفظ، حاول مرة ثانية');
    }
    setBusy('');
  };

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

  useEffect(() => {
    if (isRootAdmin) loadAdmins().then(setAdmins).catch(() => toast('ما قدرنا نحمّل المشرفين'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRootAdmin]);

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mail.includes('@') || busy) return;
    setBusy('admin');
    const err = await addAdmin(mail);
    if (err) toast(err);
    else {
      toast('انضاف مشرف جديد');
      setMail('');
      loadAdmins().then(setAdmins).catch(() => {});
    }
    setBusy('');
  };

  const dismiss = async (a: Admin) => {
    setBusy(a.userId);
    const err = await removeAdmin(a.userId);
    if (err) toast(err);
    else {
      toast(`انشالت صلاحية ${a.name}`);
      setAdmins((l) => (l ?? []).filter((x) => x.userId !== a.userId));
    }
    setBusy('');
  };

  const destroy = async () => {
    if (!doomed || busy) return;
    setBusy(doomed.id);
    try {
      await adminDeleteListing(doomed.id, reason.trim());
      toast('انحذف الإعلان');
      setDoomed(null);
      setReason('');
    } catch {
      toast('ما انحذف الإعلان، حاول مرة ثانية');
    }
    setBusy('');
  };

  const needle = q.trim().toLowerCase();
  const found = all.filter((l) => !needle || `${l.title} ${l.ownerName} ${l.city}`.toLowerCase().includes(needle)).slice(0, needle ? 40 : 8);

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

      <h2 className="h3 admin-h">البلاغات{reports?.length ? ` — ${reports.length}` : ''}</h2>
      {reports === null ? <div className="skeleton admin-skel" /> : reports.length === 0 ? (
        <p className="hint admin-none">ما فيه بلاغات مفتوحة.</p>
      ) : (
        <AnimatePresence initial={false}>
          {reports.map((r) => {
            const l = r.listingId ? all.find((x) => x.id === r.listingId) : undefined;
            return (
              <motion.div layout key={r.id} className="offer" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 40 }}>
                <div className="offer-main">
                  <div className="offer-top">
                    <strong>{REPORT_REASONS.find((x) => x.id === r.reason)?.label}</strong>
                    <span className="status">{r.target === 'user' ? 'عن مستخدم' : 'عن إعلان'}</span>
                  </div>
                  <div className="offer-sub">
                    {r.target === 'user' && <span>المبلَّغ عنه: {r.reportedName ?? 'حساب محذوف'}</span>}
                    {r.listingId && (l ? <Link href={`/listing/${l.id}`}>الإعلان: {l.title}</Link> : <span>الإعلان: {r.listingTitle ?? '—'} (محذوف)</span>)}
                    {r.target === 'listing' && r.reportedName && <span>صاحبه: {r.reportedName}</span>}
                    <span>المبلِّغ: {r.reporterName ?? 'حساب محذوف'}</span>
                    <span suppressHydrationWarning>{timeAgo(r.createdAt)}</span>
                  </div>
                  {r.details && <p className="offer-note">«{r.details}»</p>}
                  <div className="offer-actions">
                    {l && <button className="btn btn-ghost btn-sm admin-del" onClick={() => { setDoomed(l); setReason(REPORT_REASONS.find((x) => x.id === r.reason)?.label ?? ''); }}><Trash2 size={15} /> احذف الإعلان</button>}
                    <button className="btn btn-primary btn-sm" disabled={busy === r.id} onClick={() => closeReport(r.id)}><Check size={15} /> تمت المراجعة</button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      )}

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

      <h2 className="h3 admin-h">الإعلانات</h2>
      <label className="search admin-search">
        <Search size={18} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث باسم الإعلان أو صاحبه أو المدينة…" aria-label="بحث في الإعلانات" />
      </label>
      <p className="hint admin-count">{needle ? `${found.length} نتيجة` : `أحدث ${found.length} من ${all.length} إعلان — ابحث عشان توصل لإعلان محدد`}</p>
      {found.length === 0 ? <p className="hint admin-none">ما فيه إعلان بهذا البحث.</p> : (
        <AnimatePresence initial={false}>
          {found.map((l) => (
            <motion.div layout key={l.id} className="offer admin-listing" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 40 }}>
              <Link href={`/listing/${l.id}`} className="mine-thumb"><ListingArt listing={l} iconSize={22} /></Link>
              <div className="offer-main">
                <div className="offer-top">
                  <Link href={`/listing/${l.id}`}><strong>{l.title}</strong></Link>
                  <span className="status">{KINDS.find((k) => k.id === l.kind)?.name}</span>
                  {l.kind === 'auction' && !l.startsAt && <span className="status status-demo">غير مفعّل</span>}
                </div>
                <div className="offer-sub">
                  <span>{l.ownerId === me.id ? 'إعلانك' : `صاحبه: ${l.ownerName}`}</span>
                  <span>{l.city}</span>
                  <span suppressHydrationWarning>{timeAgo(l.createdAt)}</span>
                </div>
              </div>
              <button className="btn btn-ghost btn-sm admin-del" onClick={() => { setDoomed(l); setReason(''); }}><Trash2 size={15} /> حذف</button>
            </motion.div>
          ))}
        </AnimatePresence>
      )}

      {isRootAdmin && (
        <>
          <h2 className="h3 admin-h">المشرفون</h2>
          <p className="hint admin-count">المشرف يفعّل تحويلات المزادات ويحذف الإعلانات. إضافة المشرفين وإزالتهم لك أنت فقط.</p>
          <form className="want-input" onSubmit={invite}>
            <input className="input" dir="ltr" type="email" value={mail} onChange={(e) => setMail(e.target.value)} placeholder="بريد حساب المشرف في الموقع" aria-label="بريد المشرف الجديد" />
            <button className="btn btn-primary" disabled={!mail.includes('@') || busy === 'admin'}><UserPlus size={16} /> أضف مشرف</button>
          </form>
          {admins === null ? <div className="skeleton admin-skel" /> : admins.map((a) => (
            <div key={a.userId} className="offer admin-listing">
              <span className="offer-thumb"><ShieldCheck size={22} strokeWidth={1.5} /></span>
              <div className="offer-main">
                <div className="offer-top"><strong>{a.name}</strong>{a.isRoot && <span className="status status-accepted">أساسي</span>}{a.userId === me.id && <span className="status">أنت</span>}</div>
                <div className="offer-sub"><span dir="ltr">{a.email}</span></div>
              </div>
              {!a.isRoot && <button className="btn btn-ghost btn-sm admin-del" disabled={busy === a.userId} onClick={() => dismiss(a)}><X size={15} /> إزالة</button>}
            </div>
          ))}
        </>
      )}

      <AnimatePresence>
        {doomed && (
          <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !busy && setDoomed(null)}>
            <motion.div
              className="modal" role="dialog" aria-modal="true" aria-label="حذف إعلان" onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, y: 40, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 30 }} transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            >
              <div className="modal-head">
                <div>
                  <h2>حذف الإعلان؟</h2>
                  <p>{doomed.title} — {doomed.ownerName}</p>
                </div>
                <button type="button" className="icon-btn" onClick={() => setDoomed(null)} aria-label="إغلاق"><X size={18} /></button>
              </div>
              <p className="hint admin-warn">
                الحذف نهائي وما ينرجع: ينحذف الإعلان مع كل عروضه ومزايداته ومحادثاته.
                {doomed.kind === 'auction' && doomed.startsAt ? ' هذا مزاد مفعّل — لو فيه رسوم مدفوعة عليه، استرجاعها عليك حسب سياسة الموقع.' : ''}
              </p>
              <label className="field">
                <span className="label">سبب الحذف (يُحفظ في سجل الإدارة)</span>
                <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثال: غرض ممنوع، إعلان مكرر، احتيال…" maxLength={300} autoFocus />
              </label>
              <div className="pledge-actions admin-actions">
                <button className="btn btn-danger btn-lg" disabled={!!busy} onClick={destroy}><Trash2 size={17} /> {busy ? 'جاري الحذف…' : 'احذف الإعلان نهائياً'}</button>
                <button className="btn btn-ghost btn-lg" disabled={!!busy} onClick={() => setDoomed(null)}>إلغاء</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
