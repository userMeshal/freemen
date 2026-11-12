'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { ImagePlus, X } from 'lucide-react';
import { CATEGORIES, CONDITIONS, VALUE_TIERS, type Listing } from '@/lib/data';
import { fileToDataUrl, useStore } from '@/lib/store';
import { FairnessMeter } from './Fairness';

export default function OfferModal({ listing, onClose }: { listing: Listing; onClose: () => void }) {
  const { me, setMe, listings, addOffer, toast } = useStore();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0].id);
  const [condition, setCondition] = useState(CONDITIONS[1]);
  const [tier, setTier] = useState(listing.valueTier);
  const [note, setNote] = useState('');
  const [name, setName] = useState(me.name);
  const [image, setImage] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const valid = title.trim().length > 1 && name.trim().length > 1;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    try {
      if (name.trim() !== me.name) await setMe({ name: name.trim() });
      await addOffer({ listingId: listing.id, fromName: name.trim(), itemTitle: title.trim(), itemCategory: category, itemCondition: condition, valueTier: tier, note: note.trim(), image });
      toast('انرسل عرض البدل');
      onClose();
    } catch {
      toast('ما انرسل العرض، حاول مرة ثانية');
      setBusy(false);
    }
  };

  return createPortal(
    <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.form
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="عرض بدل"
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 60, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      >
        <div className="modal-head">
          <div>
            <h2>اعرض بدلك</h2>
            <p>مقابل: {listing.title}</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="إغلاق"><X size={18} /></button>
        </div>

        {listings.length > 0 && (
          <div className="field">
            <span className="label">اختر من أغراضك المعروضة</span>
            <div className="chips chips-wrap">
              {listings.map((l) => (
                <button type="button" key={l.id} className={`chip chip-btn ${title === l.title ? 'is-solid' : ''}`}
                  onClick={() => { setTitle(l.title); setCategory(l.category); setCondition(l.condition); setTier(l.valueTier); setImage(l.images[0]); }}>
                  {l.title}
                </button>
              ))}
            </div>
          </div>
        )}

        <label className="field">
          <span className="label">وش بتعرض؟</span>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: بلايستيشن 5 مع يدين" autoFocus required />
        </label>

        <div className="row">
          <label className="field">
            <span className="label">القسم</span>
            <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="label">الحالة</span>
            <select className="select" value={condition} onChange={(e) => setCondition(e.target.value)}>
              {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
        </div>

        <label className="field">
          <span className="label">القيمة التقريبية لغرضك (ريال)</span>
          <select className="select" value={tier} onChange={(e) => setTier(Number(e.target.value))}>
            {VALUE_TIERS.map((v, i) => <option key={v} value={i}>{v}</option>)}
          </select>
        </label>
        <FairnessMeter a={listing.valueTier} b={tier} />

        <label className="field">
          <span className="label">رسالة لصاحب العرض (اختياري)</span>
          <textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="حالة الغرض، وين تتقابلون…" />
        </label>

        <div className="row">
          <label className="field">
            <span className="label">اسمك</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم الأول يكفي" required />
          </label>
          <label className="field">
            <span className="label">صورة (اختياري)</span>
            <span className="upload-inline">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {image ? <img src={image} alt="" /> : <ImagePlus size={18} />}
              {image ? 'تغيير الصورة' : 'أضف صورة'}
              <input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) setImage(await fileToDataUrl(f, 700)); }} />
            </span>
          </label>
        </div>

        <button className="btn btn-primary btn-lg btn-block" disabled={!valid || busy}>{busy ? 'جاري الإرسال…' : 'أرسل عرض البدل'}</button>
      </motion.form>
    </motion.div>,
    document.body,
  );
}
