'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, ImagePlus, Plus, X } from 'lucide-react';
import { CategoryIcon, EASE } from '@/components/ui';
import { CATEGORIES, CITIES, CONDITIONS, VALUE_TIERS, type Listing } from '@/lib/data';
import { fileToDataUrl, useStore } from '@/lib/store';

const STEP_TITLES = ['وش عندك؟', 'عطنا التفاصيل', 'وش تبي بداله؟'];
const SUGGEST = ['آيفون', 'بلايستيشن 5', 'ماك بوك', 'ساعة ذكية', 'دراجة', 'آيباد', 'كاميرا'];

export default function NewListing() {
  const { me, setMe, addListing, toast } = useStore();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [done, setDone] = useState<Listing | null>(null);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [condition, setCondition] = useState(CONDITIONS[1]);
  const [city, setCity] = useState(me.city || CITIES[0]);
  const [tier, setTier] = useState(1);
  const [description, setDescription] = useState('');
  const [wants, setWants] = useState<string[]>([]);
  const [want, setWant] = useState('');
  const [open, setOpen] = useState(true);
  const [name, setName] = useState(me.name);
  const [whatsapp, setWhatsapp] = useState(me.whatsapp);

  const ok = [
    title.trim().length > 2 && !!category,
    true,
    (wants.length > 0 || open) && name.trim().length > 1,
  ][step];

  const go = (d: number) => { setDir(d); setStep((s) => s + d); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const addWant = (w: string) => {
    const v = w.trim();
    if (v && !wants.includes(v) && wants.length < 6) setWants([...wants, v]);
    setWant('');
  };
  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    const next = await Promise.all(Array.from(files).slice(0, 3 - images.length).map((f) => fileToDataUrl(f)));
    setImages((x) => [...x, ...next]);
  };
  const publish = () => {
    setMe({ name: name.trim(), city, whatsapp: whatsapp.trim() });
    const l = addListing({
      title: title.trim(), category, condition, city, description: description.trim(), wants, openToOffers: open,
      valueTier: tier, images, ownerName: name.trim(), whatsapp: whatsapp.trim() || undefined,
    });
    setDone(l);
    toast('انتشر عرضك');
  };

  if (done) {
    return (
      <div className="container page page-narrow success">
        <motion.div className="success-ring" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 14 }}>
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.25, type: 'spring', stiffness: 300, damping: 12 }}><Check size={44} strokeWidth={2.5} /></motion.span>
        </motion.div>
        <motion.h1 className="h2" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.7, ease: EASE }}>عرضك صار على بدل</motion.h1>
        <motion.p className="lead" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}>«{done.title}» الحين معروض. أول ما يوصلك عرض بدل بننبّهك.</motion.p>
        <motion.div className="hero-cta" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
          <Link href="/offers" className="btn btn-primary btn-lg">تابع العروض</Link>
          <Link href={`/listing/${done.id}`} className="btn btn-ghost btn-lg">شوف عرضك</Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="container page page-narrow">
      <div className="wizard-top">
        <span className="eyebrow">الخطوة {step + 1} من 3</span>
        <div className="progress"><motion.span animate={{ scaleX: (step + 1) / 3 }} transition={{ duration: 0.6, ease: EASE }} /></div>
      </div>

      <AnimatePresence mode="wait" custom={dir}>
        <motion.div
          key={step}
          custom={dir}
          initial={{ opacity: 0, x: dir * -50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: dir * 50 }}
          transition={{ duration: 0.4, ease: EASE }}
        >
          <h1 className="h2 wizard-title">{STEP_TITLES[step]}</h1>

          {step === 0 && (
            <>
              <label className="field">
                <span className="label">اسم الغرض</span>
                <input className="input input-xl" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: آيفون 14 برو 256 قيقا" autoFocus maxLength={60} />
              </label>
              <div className="field">
                <span className="label">القسم</span>
                <div className="cat-grid">
                  {CATEGORIES.map((c, i) => (
                    <motion.button
                      type="button" key={c.id} className={`cat ${category === c.id ? 'is-on' : ''}`} onClick={() => setCategory(c.id)} aria-pressed={category === c.id}
                      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03, duration: 0.4 }} whileTap={{ scale: 0.95 }}
                    >
                      <CategoryIcon id={c.id} size={24} strokeWidth={1.4} />
                      {c.name}
                    </motion.button>
                  ))}
                </div>
              </div>
              <div className="field">
                <span className="label">الصور (حتى 3 — اختياري)</span>
                <div className="uploads">
                  <AnimatePresence>
                    {images.map((src, i) => (
                      <motion.div key={src.slice(-24) + i} className="upload-thumb" layout initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt="" />
                        <button type="button" onClick={() => setImages(images.filter((_, x) => x !== i))} aria-label="حذف الصورة"><X size={14} /></button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {images.length < 3 && (
                    <label className="upload-add">
                      <ImagePlus size={24} strokeWidth={1.4} />
                      <span>أضف صورة</span>
                      <input type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
                    </label>
                  )}
                </div>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div className="field">
                <span className="label">الحالة</span>
                <div className="chips chips-wrap">
                  {CONDITIONS.map((c) => <button type="button" key={c} className={`chip chip-btn chip-lg ${condition === c ? 'is-solid' : ''}`} onClick={() => setCondition(c)}>{c}</button>)}
                </div>
              </div>
              <div className="row">
                <label className="field">
                  <span className="label">المدينة</span>
                  <select className="select" value={city} onChange={(e) => setCity(e.target.value)}>{CITIES.map((c) => <option key={c}>{c}</option>)}</select>
                </label>
                <label className="field">
                  <span className="label">القيمة التقريبية (ريال)</span>
                  <select className="select" value={tier} onChange={(e) => setTier(Number(e.target.value))}>{VALUE_TIERS.map((v, i) => <option key={v} value={i}>{v}</option>)}</select>
                </label>
              </div>
              <p className="hint">القيمة ما تنعرض كسعر — نستخدمها بس في «ميزان البدل» عشان تكون العروض عادلة.</p>
              <label className="field">
                <span className="label">الوصف</span>
                <textarea className="input" rows={5} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="الحالة، مدة الاستخدام، الملحقات…" maxLength={500} />
              </label>
            </>
          )}

          {step === 2 && (
            <>
              <div className="field">
                <span className="label">أغراض تبيها بداله</span>
                <div className="want-input">
                  <input className="input" value={want} onChange={(e) => setWant(e.target.value)} placeholder="اكتب غرض واضغط إضافة"
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addWant(want); } }} />
                  <button type="button" className="btn btn-ghost" onClick={() => addWant(want)}><Plus size={16} /> إضافة</button>
                </div>
                <div className="chips chips-wrap">
                  <AnimatePresence>
                    {wants.map((w) => (
                      <motion.button type="button" layout key={w} className="chip chip-solid chip-btn chip-lg" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}
                        onClick={() => setWants(wants.filter((x) => x !== w))} aria-label={`حذف ${w}`}>
                        {w} <X size={13} />
                      </motion.button>
                    ))}
                  </AnimatePresence>
                </div>
                <div className="chips chips-wrap suggest">
                  {SUGGEST.filter((x) => !wants.includes(x)).map((x) => <button type="button" key={x} className="chip chip-btn chip-dashed" onClick={() => addWant(x)}>+ {x}</button>)}
                </div>
              </div>

              <button type="button" className="toggle" role="switch" aria-checked={open} onClick={() => setOpen(!open)}>
                <span className={`switch ${open ? 'is-on' : ''}`}><motion.span layout transition={{ type: 'spring', stiffness: 500, damping: 32 }} /></span>
                <span><strong>استقبل أي عروض ثانية</strong><small>خلّ الناس يفاجئونك بعروض ما خطرت على بالك.</small></span>
              </button>

              <div className="row">
                <label className="field">
                  <span className="label">اسمك</span>
                  <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم الأول يكفي" />
                </label>
                <label className="field">
                  <span className="label">واتساب (اختياري)</span>
                  <input className="input" dir="ltr" inputMode="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="05XXXXXXXX" />
                </label>
              </div>
              <p className="hint">رقمك ما يظهر إلا للي تقبل عرضه.</p>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="wizard-nav">
        {step > 0 ? <button className="btn btn-ghost btn-lg" onClick={() => go(-1)}><ArrowRight size={18} /> رجوع</button> : <span />}
        {step < 2 ? (
          <button className="btn btn-primary btn-lg" disabled={!ok} onClick={() => go(1)}>التالي <ArrowLeft size={18} /></button>
        ) : (
          <motion.button className="btn btn-primary btn-lg" disabled={!ok} onClick={publish} whileTap={{ scale: 0.97 }}>انشر العرض <Check size={18} /></motion.button>
        )}
      </div>
    </div>
  );
}
