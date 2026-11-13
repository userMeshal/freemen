'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { formatSAR, parseAmount, type Listing } from '@/lib/data';
import { useStore } from '@/lib/store';

/** طلب شراء على عرض بيع: المشتري يوافق على السعر أو يعرض سعراً آخر */
export default function BuyModal({ listing, onClose }: { listing: Listing; onClose: () => void }) {
  const { me, setMe, addOffer, toast } = useStore();
  const price = listing.price ?? 0;
  const [text, setText] = useState(String(price));
  const [note, setNote] = useState('');
  const [name, setName] = useState(me.name);
  const [busy, setBusy] = useState(false);
  const amount = parseAmount(text);
  const valid = amount > 0 && name.trim().length > 1;

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
      if (name.trim() !== me.name) await setMe({ name: name.trim() });
      await addOffer({ kind: 'buy', listingId: listing.id, fromName: name.trim(), itemTitle: '', itemCategory: '', itemCondition: '', valueTier: 0, cash: amount, note: note.trim() });
      toast('انرسل طلب الشراء');
      onClose();
    } catch {
      toast('ما انرسل الطلب، حاول مرة ثانية');
      setBusy(false);
    }
  };

  return createPortal(
    <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.form
        className="modal" role="dialog" aria-modal="true" aria-label="طلب شراء" onSubmit={submit} onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 60, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 40, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      >
        <div className="modal-head">
          <div>
            <h2>اطلب الشراء</h2>
            <p>{listing.title} — {formatSAR(price)}</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="إغلاق"><X size={18} /></button>
        </div>

        <label className="field">
          <span className="label">عرضك (ريال)</span>
          <input className="input input-xl" dir="ltr" inputMode="numeric" value={text} onChange={(e) => setText(e.target.value)} autoFocus required />
        </label>
        <p className="hint">
          {amount === price ? 'نفس سعر صاحب العرض.' : amount > 0 && amount < price ? `أقل من السعر المطلوب بـ ${formatSAR(price - amount)} — القرار لصاحب العرض.` : amount > price ? 'أعلى من السعر المطلوب.' : 'اكتب المبلغ اللي تعرضه.'}
        </p>
        <label className="field">
          <span className="label">رسالة لصاحب العرض (اختياري)</span>
          <textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="متى تقدر تستلم، وين تتقابلون…" maxLength={300} />
        </label>
        <label className="field">
          <span className="label">اسمك</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم الأول يكفي" required />
        </label>
        <p className="hint">الدفع بينك وبين صاحب العرض مباشرة عند الاستلام. المنصة ما تستلم ثمن الغرض.</p>
        <button className="btn btn-primary btn-lg btn-block" disabled={!valid || busy}>{busy ? 'جاري الإرسال…' : 'أرسل طلب الشراء'}</button>
      </motion.form>
    </motion.div>,
    document.body,
  );
}
