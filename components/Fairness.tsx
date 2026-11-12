'use client';

import { motion } from 'framer-motion';
import { Scale } from 'lucide-react';
import { fairness } from '@/lib/data';

/** ميزان البدل: يقارن شريحتي القيمة ويميل ناحية الأثقل */
export function FairnessMeter({ a, b }: { a: number; b: number }) {
  const f = fairness(a, b);
  const tilt = Math.max(-2, Math.min(2, b - a)) * 7;
  return (
    <div className={`fair fair-${f.level}`}>
      <div className="fair-scale" aria-hidden>
        <motion.div className="scale-beam" animate={{ rotate: tilt }} transition={{ type: 'spring', stiffness: 120, damping: 8 }}>
          <span /><span />
        </motion.div>
      </div>
      <div>
        <strong><Scale size={14} /> ميزان البدل: {f.label}</strong>
        <small>مقارنة تقريبية بين قيمة الغرضين — القرار لكم.</small>
      </div>
    </div>
  );
}
