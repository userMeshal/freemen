'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, animate, motion, useInView } from 'framer-motion';
import {
  Baby, Bike, BookOpen, Camera, Car, Gamepad2, Gem, Heart, Laptop, MapPin, Repeat2, Smartphone, Sofa, Watch, Wrench,
  type LucideIcon,
} from 'lucide-react';
import { catById, timeAgo, type Listing } from '@/lib/data';
import { useStore } from '@/lib/store';

export const EASE = [0.22, 1, 0.36, 1] as const;

const ICONS: Record<string, LucideIcon> = {
  electronics: Smartphone, gaming: Gamepad2, cars: Car, furniture: Sofa, fashion: Watch, cameras: Camera,
  computers: Laptop, sports: Bike, books: BookOpen, kids: Baby, collectibles: Gem, services: Wrench,
};

export function CategoryIcon({ id, size = 20, strokeWidth = 1.6 }: { id: string; size?: number; strokeWidth?: number }) {
  const Icon = ICONS[id] ?? Gem;
  return <Icon size={size} strokeWidth={strokeWidth} aria-hidden />;
}

/** شعار بدلني: دائرة مقسومة نصفين يتبادلون الاتجاه — الملفات الأصلية في public/brand */
export function Logo({ size = 30 }: { size?: number }) {
  return (
    <span className="logo">
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="7.5" fill="currentColor" />
        <g fill="var(--bg)" stroke="var(--bg)" strokeWidth="1.265" strokeLinejoin="round">
          <path className="logo-top" d="M11.34 14.505A7.99 7.99 0 0 1 27.33 14.505Z" />
          <path className="logo-bot" d="M4.67 17.495A7.99 7.99 0 0 0 20.66 17.495Z" />
        </g>
      </svg>
      <span className="logo-word">بدلني</span>
    </span>
  );
}

/** لوحة لونية ناعمة تُولَّد من القسم — بديل أنيق لما ما يكون فيه صورة */
export function ListingArt({ listing, iconSize = 56 }: { listing: Pick<Listing, 'category' | 'images' | 'title' | 'id'>; iconSize?: number }) {
  if (listing.images[0]) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="art-img" src={listing.images[0]} alt={listing.title} />;
  }
  const h = catById(listing.category).hue;
  const shift = (listing.id.charCodeAt(listing.id.length - 1) % 5) * 9;
  return (
    <div
      className="art"
      style={{
        background: `radial-gradient(60% 70% at 18% 20%, hsl(${h + shift} 95% 78%) 0%, transparent 70%),
          radial-gradient(55% 65% at 85% 85%, hsl(${h + 60 + shift} 90% 76%) 0%, transparent 70%),
          radial-gradient(50% 50% at 80% 10%, hsl(${h - 40} 95% 86%) 0%, transparent 70%),
          hsl(${h} 60% 93%)`,
      }}
    >
      <span className="art-icon"><CategoryIcon id={listing.category} size={iconSize} strokeWidth={1.1} /></span>
    </div>
  );
}

export function ListingCard({ listing, index = 0 }: { listing: Listing; index?: number }) {
  const { favs, toggleFav, offersFor } = useStore();
  const fav = favs.includes(listing.id);
  const count = listing.offersCount ?? (listing.seedOffers ?? 0) + offersFor(listing.id).length;
  return (
    <motion.article
      layout
      className="card"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.6, ease: EASE, delay: Math.min(index, 8) * 0.05 }}
    >
      <Link href={`/listing/${listing.id}`} className="card-link" aria-label={listing.title}>
        <div className="card-media">
          <ListingArt listing={listing} />
          <span className="chip chip-glass card-cond">{listing.condition}</span>
        </div>
        <div className="card-body">
          <div className="card-meta">
            <span><MapPin size={13} /> {listing.city}</span>
            <span suppressHydrationWarning>{timeAgo(listing.createdAt)}</span>
          </div>
          <h3 className="card-title">{listing.title}</h3>
          <div className="card-wants">
            <Repeat2 size={15} />
            <span>{listing.wants.length ? listing.wants.join(' · ') : 'يستقبل كل العروض'}</span>
          </div>
          <div className="card-foot">
            <span className="card-count">{count ? `${count} عرض بدل` : 'كن أول من يعرض'}</span>
            <span className="card-go">اعرض بدلك ←</span>
          </div>
        </div>
      </Link>
      <motion.button
        className={`fav ${fav ? 'is-on' : ''}`}
        whileTap={{ scale: 0.8 }}
        onClick={() => toggleFav(listing.id)}
        aria-label={fav ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
        aria-pressed={fav}
      >
        <Heart size={17} fill={fav ? 'currentColor' : 'none'} />
      </motion.button>
    </motion.article>
  );
}

export function Reveal({ children, delay = 0, className, y = 28 }: { children: React.ReactNode; delay?: number; className?: string; y?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-70px' }}
      transition={{ duration: 0.8, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

export function Counter({ to, suffix = '' }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const c = animate(0, to, { duration: 1.4, ease: EASE, onUpdate: (x) => setV(Math.round(x)) });
    return () => c.stop();
  }, [inView, to]);
  return <span ref={ref}>{v}{suffix}</span>;
}

export function Toasts() {
  const { toasts } = useStore();
  return (
    <div className="toasts" role="status" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            className="toast"
            initial={{ opacity: 0, y: 24, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
          >
            <Repeat2 size={16} /> {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
