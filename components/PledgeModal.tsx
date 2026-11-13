'use client';

import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Check, Handshake, X } from 'lucide-react';
import { PLEDGE } from '@/lib/pledge';

/**
 * نافذة التعهد بسداد رسوم الموقع — تظهر قبل نشر الإعلان فعلياً.
 * الموافقة تُرسل مع طلب النشر والقاعدة ترفض النشر بدونها؛ هذه النافذة واجهتها فقط.
 */
export default function PledgeModal({ busy, onConfirm, onClose }: { busy: boolean; onConfirm: () => void; onClose: () => void }) {
  const [agreed, setAgreed] = useState(false);
  const id = useId();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose, busy]);

  return createPortal(
    <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !busy && onClose()}>
      <motion.form
        className="modal pledge" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} dir="rtl"
        onSubmit={(e) => { e.preventDefault(); if (agreed && !busy) onConfirm(); }}
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 60, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 40, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      >
        <button type="button" className="icon-btn pledge-close" onClick={onClose} disabled={busy} aria-label="إغلاق"><X size={18} /></button>

        <div className="pledge-head">
          <motion.span className="pledge-icon" initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: 0.1, type: 'spring', stiffness: 260, damping: 16 }}>
            <Handshake size={30} strokeWidth={1.5} />
          </motion.span>
          <h2 id={`${id}-title`}>{PLEDGE.title}</h2>
          <div className="pledge-fee">
            <strong>{PLEDGE.fee}</strong>
            <span>ريال<small>عن كل عملية بيع مكتملة</small></span>
          </div>
        </div>

        <blockquote className="pledge-text">
          {PLEDGE.paragraphs.map((p) => <p key={p}>{p}</p>)}
        </blockquote>

        <p className="pledge-note">ما ينسحب منك أي مبلغ الحين. هذا تعهّد بالسداد بعد إتمام البيع فقط.</p>

        <label className={`pledge-check ${agreed ? 'is-on' : ''}`} htmlFor={`${id}-agree`}>
          <input id={`${id}-agree`} type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} disabled={busy} />
          <span className="pledge-box" aria-hidden>{agreed && <Check size={15} strokeWidth={3} />}</span>
          <span>{PLEDGE.consent}</span>
        </label>

        <div className="pledge-actions">
          <button type="submit" className="btn btn-primary btn-lg" disabled={!agreed || busy}>{busy ? 'جاري النشر…' : PLEDGE.confirm}</button>
          <button type="button" className="btn btn-ghost btn-lg" onClick={onClose} disabled={busy}>إلغاء</button>
        </div>
      </motion.form>
    </motion.div>,
    document.body,
  );
}
