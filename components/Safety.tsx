'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Ban, Flag, X } from 'lucide-react';
import { REPORT_REASONS, type NewReport, type ReportReason } from '@/lib/data';
import { useStore } from '@/lib/store';

function Sheet({ label, onClose, children }: { label: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);
  return createPortal(
    <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        className="modal" role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 50, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 30 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      >
        {children}
      </motion.div>
    </motion.div>,
    document.body,
  );
}

/** نافذة التبليغ عن إعلان أو مستخدم — البلاغ يوصل لإدارة الموقع */
function ReportModal({ subject, base, onClose }: { subject: string; base: Omit<NewReport, 'reason' | 'details'>; onClose: () => void }) {
  const { report, toast } = useStore();
  const reasons = REPORT_REASONS.filter((r) => (base.target === 'user' ? r.id !== 'prohibited' && r.id !== 'misleading' : r.id !== 'harassment'));
  const [reason, setReason] = useState<ReportReason | ''>('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason || busy) return;
    setBusy(true);
    try {
      await report({ ...base, reason, details: details.trim() });
      toast('وصلنا بلاغك — بنراجعه ونتصرف');
      onClose();
    } catch {
      toast('ما انرسل البلاغ، حاول مرة ثانية');
      setBusy(false);
    }
  };

  return (
    <Sheet label="تبليغ" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="modal-head">
          <div>
            <h2>{base.target === 'user' ? 'تبليغ عن مستخدم' : 'تبليغ عن إعلان'}</h2>
            <p>{subject}</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="إغلاق"><X size={18} /></button>
        </div>
        <div className="field">
          <span className="label">وش المشكلة؟</span>
          <div className="chips chips-wrap" role="radiogroup" aria-label="سبب البلاغ">
            {reasons.map((r) => (
              <button type="button" key={r.id} role="radio" aria-checked={reason === r.id} className={`chip chip-btn chip-lg ${reason === r.id ? 'is-solid' : ''}`} onClick={() => setReason(r.id)}>{r.label}</button>
            ))}
          </div>
        </div>
        <label className="field">
          <span className="label">تفاصيل تساعدنا (اختياري)</span>
          <textarea className="input" rows={3} value={details} onChange={(e) => setDetails(e.target.value)} maxLength={500} placeholder="وش اللي صار بالضبط؟" />
        </label>
        <p className="hint">البلاغ يوصل لإدارة الموقع فقط، والطرف الثاني ما يعرف من بلّغ عنه.</p>
        <button className="btn btn-primary btn-lg btn-block report-send" disabled={!reason || busy}>{busy ? 'جاري الإرسال…' : 'أرسل البلاغ'}</button>
      </form>
    </Sheet>
  );
}

/**
 * زرّا «تبليغ» و«حظر» — يظهران في صفحة الإعلان وفي المحادثة.
 * listing: التبليغ عن الإعلان نفسه. user: التبليغ عن المستخدم (في المحادثات).
 */
export default function SafetyActions({ target, userId, userName, listingId, listingTitle, afterBlock }: {
  target: 'listing' | 'user'; userId: string; userName: string; listingId?: string; listingTitle?: string; afterBlock?: string;
}) {
  const router = useRouter();
  const { authed, blockUser, toast } = useStore();
  const [open, setOpen] = useState<'report' | 'block' | null>(null);
  const [busy, setBusy] = useState(false);
  const ask = (what: 'report' | 'block') => (authed ? setOpen(what) : router.push('/login'));

  const block = async () => {
    setBusy(true);
    try {
      await blockUser(userId, userName);
      toast(`انحظر ${userName}`);
      setOpen(null);
      if (afterBlock) router.push(afterBlock);
    } catch {
      toast('ما انحظر المستخدم، حاول مرة ثانية');
    }
    setBusy(false);
  };

  return (
    <>
      <div className="safety">
        <button type="button" onClick={() => ask('report')}><Flag size={14} /> {target === 'listing' ? 'بلّغ عن الإعلان' : 'تبليغ'}</button>
        <button type="button" onClick={() => ask('block')}><Ban size={14} /> {target === 'listing' ? 'احظر المعلن' : 'حظر'}</button>
      </div>
      <AnimatePresence>
        {open === 'report' && (
          <ReportModal
            subject={target === 'listing' ? listingTitle ?? '' : userName}
            base={{ target, listingId, listingTitle, reportedUserId: userId }}
            onClose={() => setOpen(null)}
          />
        )}
        {open === 'block' && (
          <Sheet label="حظر" onClose={() => setOpen(null)}>
            <div className="modal-head">
              <div>
                <h2>تحظر {userName}؟</h2>
              </div>
              <button type="button" className="icon-btn" onClick={() => setOpen(null)} aria-label="إغلاق"><X size={18} /></button>
            </div>
            <p className="block-text">
              ما راح يقدر يراسلك ولا يقدّم عروض على إعلاناتك، وما راح تشوف إعلاناته ولا محادثاته. تقدر تفك الحظر أي وقت من صفحة «عروضي».
            </p>
            <div className="pledge-actions admin-actions">
              <button className="btn btn-danger btn-lg" disabled={busy} onClick={block}><Ban size={17} /> {busy ? 'لحظة…' : 'احظر'}</button>
              <button className="btn btn-ghost btn-lg" disabled={busy} onClick={() => setOpen(null)}>إلغاء</button>
            </div>
          </Sheet>
        )}
      </AnimatePresence>
    </>
  );
}
