'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AnimatePresence, MotionConfig, motion, useMotionValueEvent, useScroll } from 'framer-motion';
import { Menu, Moon, Plus, Sun, X } from 'lucide-react';
import { StoreProvider, useStore } from '@/lib/store';
import { EASE, Logo, Toasts } from './ui';

const LINKS = [
  { href: '/browse', label: 'تصفّح العروض' },
  { href: '/#how', label: 'كيف يشتغل' },
  { href: '/offers', label: 'عروضي' },
];

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.dataset.theme === 'dark'), []);
  const flip = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
    try { localStorage.setItem('badal:theme', next ? 'dark' : 'light'); } catch {}
  };
  return (
    <button className="icon-btn" onClick={flip} aria-label={dark ? 'الوضع الفاتح' : 'الوضع الداكن'}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={dark ? 'd' : 'l'}
          initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
          animate={{ rotate: 0, opacity: 1, scale: 1 }}
          exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
          transition={{ duration: 0.25 }}
          style={{ display: 'grid' }}
        >
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

function Nav() {
  const pathname = usePathname();
  const { offers, listings, me } = useStore();
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, 'change', (y) => {
    const prev = scrollY.getPrevious() ?? 0;
    setScrolled(y > 12);
    setHidden(y > 240 && y > prev);
  });
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
  }, [open]);

  const mine = new Set(listings.map((l) => l.id));
  const pending = offers.filter((o) => o.status === 'pending' && mine.has(o.listingId) && o.fromId !== me.id).length;

  return (
    <>
      <motion.header
        className={`nav ${scrolled ? 'is-scrolled' : ''}`}
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: hidden && !open ? -90 : 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: EASE }}
      >
        <div className="nav-inner">
          <Link href="/" aria-label="بدل — الرئيسية"><Logo /></Link>
          <nav className="nav-links" aria-label="التنقل الرئيسي">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className={pathname === l.href ? 'is-active' : ''}>
                {l.label}
                {l.href === '/offers' && pending > 0 && <span className="badge">{pending}</span>}
              </Link>
            ))}
          </nav>
          <div className="nav-actions">
            <ThemeToggle />
            <Link href="/new" className="btn btn-primary btn-sm nav-cta"><Plus size={16} /> اعرض غرضك</Link>
            <button className="icon-btn nav-burger" onClick={() => setOpen((o) => !o)} aria-label="القائمة" aria-expanded={open}>
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </motion.header>

      <AnimatePresence>
        {open && (
          <motion.div
            className="menu"
            initial={{ opacity: 0, clipPath: 'circle(0% at 10% 0%)' }}
            animate={{ opacity: 1, clipPath: 'circle(150% at 10% 0%)' }}
            exit={{ opacity: 0, clipPath: 'circle(0% at 10% 0%)' }}
            transition={{ duration: 0.55, ease: EASE }}
          >
            {[...LINKS, { href: '/new', label: 'اعرض غرضك' }].map((l, i) => (
              <motion.div key={l.href} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 + i * 0.07, duration: 0.5, ease: EASE }}>
                <Link href={l.href} onClick={() => setOpen(false)}>{l.label}</Link>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div>
          <Logo size={32} />
          <p className="footer-tag">سوق المقايضة السعودي.<br />غرض بغرض — بدون ولا ريال.</p>
        </div>
        <div className="footer-col">
          <h4>المنصة</h4>
          <Link href="/browse">تصفّح العروض</Link>
          <Link href="/new">اعرض غرضك</Link>
          <Link href="/offers">عروضي</Link>
        </div>
        <div className="footer-col">
          <h4>بدل بأمان</h4>
          <span>قابِل في مكان عام</span>
          <span>افحص الغرض قبل البدل</span>
          <span>لا تحوّل فلوس لأحد</span>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} بدل. صُنع في السعودية.</span>
        <span>نسخة تجريبية — البيانات محفوظة على جهازك</span>
      </div>
      <div className="footer-giant" aria-hidden>بدل</div>
    </footer>
  );
}

export default function Chrome({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <StoreProvider>
        <Nav />
        {children}
        <Footer />
        <Toasts />
      </StoreProvider>
    </MotionConfig>
  );
}
