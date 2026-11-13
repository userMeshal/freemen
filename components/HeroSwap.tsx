'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, MapPin, Repeat2 } from 'lucide-react';
import { catById } from '@/lib/data';
import { CategoryIcon, EASE } from './ui';

const PAIRS = [
  [{ t: 'آيفون 14 برو', c: 'electronics', city: 'الرياض' }, { t: 'بلايستيشن 5', c: 'gaming', city: 'الرياض' }],
  [{ t: 'كنب زاوية', c: 'furniture', city: 'جدة' }, { t: 'دراجة جبلية', c: 'sports', city: 'جدة' }],
  [{ t: 'كاميرا سوني', c: 'cameras', city: 'الدمام' }, { t: 'ماك بوك اير', c: 'computers', city: 'الخبر' }],
  [{ t: 'تصميم هوية', c: 'services', city: 'أبها' }, { t: 'تصوير منتجات', c: 'cameras', city: 'أبها' }],
  [{ t: 'ساعة أوميغا', c: 'fashion', city: 'مكة' }, { t: 'عملات نادرة', c: 'collectibles', city: 'الطائف' }],
];

type Item = (typeof PAIRS)[number][number];

function MiniCard({ item }: { item: Item }) {
  const h = catById(item.c).hue;
  return (
    <div className="swap-card">
      <div
        className="swap-art"
        style={{
          background: `radial-gradient(70% 80% at 15% 15%, hsl(${h} 95% 76%) 0%, transparent 70%),
            radial-gradient(60% 70% at 90% 90%, hsl(${h + 70} 92% 74%) 0%, transparent 70%), hsl(${h - 30} 80% 90%)`,
        }}
      >
        <CategoryIcon id={item.c} size={54} strokeWidth={1.1} />
      </div>
      <div className="swap-info">
        <strong>{item.t}</strong>
        <span><MapPin size={12} /> {item.city}</span>
      </div>
    </div>
  );
}

/** مشهد البطل: غرضان يتبادلان مكانهما فعلياً — فكرة الموقع في حركة واحدة */
export default function HeroSwap() {
  const [i, setI] = useState(0);
  const [swapped, setSwapped] = useState(false);
  const [d, setD] = useState(190);

  useEffect(() => {
    const fit = () => setD(window.innerWidth < 560 ? 150 : 190);
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  useEffect(() => {
    const a = setTimeout(() => setSwapped(true), 1300);
    const b = setTimeout(() => {
      setSwapped(false);
      setI((x) => (x + 1) % PAIRS.length);
    }, 4200);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [i]);

  const [a, b] = PAIRS[i];
  const spring = { duration: 1.1, ease: EASE };

  return (
    <div className="swap" aria-hidden>
      <div className="swap-orbit" />
      <AnimatePresence mode="wait">
        <motion.div
          key={i}
          className="swap-stage"
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -16 }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          <motion.div
            className="swap-slot"
            animate={swapped ? { x: -d, y: [0, -46, 0], rotate: [-5, 4, 5], scale: [1, 1.07, 1] } : { x: 0, y: 0, rotate: -5, scale: 1 }}
            transition={spring}
            style={{ zIndex: 3 }}
          >
            <MiniCard item={a} />
          </motion.div>
          <motion.div
            className="swap-slot"
            animate={swapped ? { x: d, y: [0, 46, 0], rotate: [5, -4, -5], scale: [1, 0.93, 1] } : { x: 0, y: 0, rotate: 5, scale: 1 }}
            transition={spring}
            style={{ zIndex: 1 }}
          >
            <MiniCard item={b} />
          </motion.div>
        </motion.div>
      </AnimatePresence>

      <motion.div className="swap-core" animate={{ rotate: swapped ? 180 : 0, scale: swapped ? [1, 1.25, 1] : 1 }} transition={{ duration: 0.9, ease: EASE }}>
        <Repeat2 size={22} />
      </motion.div>

      <AnimatePresence>
        {swapped && (
          <motion.div
            className="swap-done"
            initial={{ opacity: 0, y: 14, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ delay: 0.9, type: 'spring', stiffness: 400, damping: 22 }}
          >
            <span className="swap-check"><Check size={13} strokeWidth={3} /></span> تم البدل — غرض بغرض
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
