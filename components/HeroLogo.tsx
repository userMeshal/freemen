'use client';

import { useId, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { LOGO } from '@/lib/logo';
import { EASE } from './ui';

/** شخابيط مرسومة باليد حول الشعار — كل واحدة ترسم نفسها بالترتيب */
const SCRIBBLES: { d: string; tone: 'a' | 'b' | 'c' | 'ink'; delay: number; dur?: number }[] = [
  // خط تحت الشعار ينتهي بلفّة
  { d: 'M985 338C800 322 560 372 380 347S150 320 62 354C18 372 38 400 92 389C152 376 122 342 72 350', tone: 'a', delay: 0.95, dur: 0.9 },
  // شرارة فوق اليمين
  { d: 'M1042 -8L1088 -62', tone: 'b', delay: 1.5, dur: 0.25 },
  { d: 'M1078 24L1146 8', tone: 'b', delay: 1.6, dur: 0.25 },
  { d: 'M1012 -40L1022 -108', tone: 'b', delay: 1.7, dur: 0.25 },
  // لولب فوق اليسار
  { d: 'M-38 34C-112 12-112-82-40-82C12-82 22-20-30-20C-62-20-64-54-40-54', tone: 'c', delay: 1.75, dur: 0.7 },
  // نجمة بين الحروف
  { d: 'M498 -98L542 -44', tone: 'a', delay: 2.1, dur: 0.2 },
  { d: 'M542 -98L498 -44', tone: 'a', delay: 2.2, dur: 0.2 },
  { d: 'M488 -71L552 -71', tone: 'a', delay: 2.3, dur: 0.2 },
  // سهم منحني يشير للشعار
  { d: 'M-118 338C-128 252-86 204-26 192', tone: 'ink', delay: 2.25, dur: 0.5 },
  { d: 'M-58 170L-22 192L-52 222', tone: 'ink', delay: 2.7, dur: 0.25 },
  // خط متعرّج ودائرة صغيرة على اليمين
  { d: 'M1058 262L1090 232L1112 268L1144 236L1166 268', tone: 'b', delay: 2.5, dur: 0.5 },
  { d: 'M1118 142A13 13 0 1 0 1144 142A13 13 0 1 0 1118 142', tone: 'c', delay: 2.85, dur: 0.35 },
];

/** الشعار في واجهة الرئيسية: ينكشف من اليمين ثم ترتسم حوله الشخابيط وتهتز كأنها مرسومة باليد */
export default function HeroLogo() {
  const id = useId().replace(/:/g, '');
  const still = useReducedMotion();
  const [run, setRun] = useState(0);

  return (
    <motion.div
      className="hero-logo" role="img" aria-label="حطّها"
      onClick={() => setRun((r) => r + 1)}
      animate={still ? undefined : { y: [0, -5, 0] }}
      transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 3.2 }}
    >
      <svg key={run} viewBox={`0 0 ${LOGO.width} ${LOGO.height}`} aria-hidden>
        <defs>
          <clipPath id={`${id}-reveal`}>
            <motion.rect
              y={-20} height={LOGO.height + 40}
              initial={still ? { x: 0, width: LOGO.width } : { x: LOGO.width, width: 0 }}
              animate={{ x: 0, width: LOGO.width }}
              transition={{ duration: 1.05, ease: EASE, delay: 0.1 }}
            />
          </clipPath>
          {/* اهتزاز الخط المرسوم باليد: تشويه خفيف يتبدّل عدة مرات بالثانية */}
          <filter id={`${id}-boil`} x="-20%" y="-60%" width="140%" height="220%">
            <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="2" seed="3" result="noise">
              {!still && <animate attributeName="seed" values="3;11;27;42;8" dur="0.75s" calcMode="discrete" repeatCount="indefinite" />}
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="9" />
          </filter>
        </defs>

        <motion.path
          d={LOGO.path} fill="currentColor" fillRule="evenodd" clipPath={`url(#${id}-reveal)`}
          initial={still ? false : { skewX: -10, opacity: 0.6 }} animate={{ skewX: 0, opacity: 1 }}
          transition={{ duration: 1.05, ease: EASE, delay: 0.1 }}
          style={{ transformOrigin: 'center', transformBox: 'fill-box' }}
        />

        <g className="scribbles" filter={`url(#${id}-boil)`} fill="none" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round">
          {SCRIBBLES.map((s, i) => (
            <motion.path
              key={i} d={s.d} className={`scribble-${s.tone}`}
              initial={still ? false : { pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ pathLength: { duration: s.dur ?? 0.4, ease: 'easeOut', delay: s.delay }, opacity: { duration: 0.01, delay: s.delay } }}
            />
          ))}
        </g>
      </svg>
    </motion.div>
  );
}
