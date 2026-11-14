"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { Menu, Moon, ShieldCheck, ShoppingBag, Sun, X } from "lucide-react";
import { cartCount, useCart } from "../cart";
import { SLink, useHref, useStore } from "../ctx";

export const EASE = [0.22, 1, 0.36, 1] as const;
type NavLink = { href: string; label: string };

function ModeToggle() {
  const { store } = useStore();
  const [dark, setDark] = useState(store.palette.dark);
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".t-soft");
    setDark(root?.dataset.mode === "dark");
  }, []);
  const flip = () => {
    const next = !dark;
    setDark(next);
    const root = document.querySelector<HTMLElement>(".t-soft");
    if (root) root.dataset.mode = next ? "dark" : "light";
    try {
      localStorage.setItem(`zaar-mode:${store.slug}`, next ? "dark" : "light");
    } catch {}
  };
  return (
    <button className="s-icon-btn" onClick={flip} aria-label={dark ? "الوضع الفاتح" : "الوضع الداكن"}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={dark ? "d" : "l"}
          initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
          animate={{ rotate: 0, opacity: 1, scale: 1 }}
          exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
          transition={{ duration: 0.25 }}
          style={{ display: "grid" }}
        >
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

/** الشريط العلوي (من تصميم «حطّها»): كبسولة زجاجية عائمة تختفي عند النزول */
export function SoftNav({ links }: { links: NavLink[] }) {
  const { store } = useStore();
  const href = useHref();
  const pathname = usePathname();
  const items = useCart((s) => s.items);
  const hydrated = useCart((s) => s.hydrated);
  const openCart = useCart((s) => s.open);
  const count = hydrated ? cartCount(items) : 0;
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (y) => {
    const prev = scrollY.getPrevious() ?? 0;
    setScrolled(y > 12);
    setHidden(y > 240 && y > prev);
  });
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <motion.header
        className={`s-nav ${scrolled ? "s-is-scrolled" : ""}`}
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: hidden && !open ? -90 : 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: EASE }}
      >
        <div className="s-nav-inner">
          <SLink href="/" aria-label={`${store.name} — الرئيسية`} className="font-display text-[1.45rem] font-extrabold leading-none">
            {store.name}
          </SLink>
          <nav className="s-nav-links" aria-label="التنقل الرئيسي">
            {links.map((l) => (
              <SLink key={l.href} href={l.href} className={pathname === href(l.href.split("?")[0]) ? "s-is-active" : ""}>
                {l.label}
              </SLink>
            ))}
          </nav>
          <div className="s-nav-actions">
            <ModeToggle />
            <button className="s-btn s-btn-primary s-btn-sm" onClick={openCart} aria-label={`السلة (${count})`}>
              <ShoppingBag size={16} /> السلة
              {count > 0 && (
                <span className="s-badge num" style={{ background: "var(--inv-ink)", color: "var(--inv)" }}>
                  {count}
                </span>
              )}
            </button>
            <button className="s-icon-btn s-nav-burger" onClick={() => setOpen((o) => !o)} aria-label="القائمة" aria-expanded={open}>
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </motion.header>

      <AnimatePresence>
        {open && (
          <motion.div
            className="s-menu"
            initial={{ opacity: 0, clipPath: "circle(0% at 10% 0%)" }}
            animate={{ opacity: 1, clipPath: "circle(150% at 10% 0%)" }}
            exit={{ opacity: 0, clipPath: "circle(0% at 10% 0%)" }}
            transition={{ duration: 0.55, ease: EASE }}
          >
            {[{ href: "/", label: "الرئيسية" }, ...links, { href: "/track", label: "تتبّع طلبك" }].map((l, i) => (
              <motion.div key={l.href} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 + i * 0.07, duration: 0.5, ease: EASE }}>
                <SLink href={l.href} onClick={() => setOpen(false)}>
                  {l.label}
                </SLink>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export function SoftFooter({ links }: { links: NavLink[] }) {
  const { store, guaranteeDays } = useStore();
  const s = store.settings;
  return (
    <footer className="s-footer">
      <div className="s-container s-footer-grid">
        <div>
          <span className="font-display text-3xl font-extrabold">{store.name}</span>
          <p className="s-footer-tag">{store.tagline}</p>
        </div>
        <div className="s-footer-col">
          <h4>المتجر</h4>
          {links.map((l) => (
            <SLink key={l.href} href={l.href}>
              {l.label}
            </SLink>
          ))}
        </div>
        <div className="s-footer-col">
          <h4>المساعدة</h4>
          <SLink href="/track">تتبّع طلبك</SLink>
          <SLink href="/pages/shipping">الشحن والتوصيل</SLink>
          <SLink href="/pages/returns">الاستبدال والاسترجاع</SLink>
          <SLink href="/pages/guarantee">ضمان زار</SLink>
          {s.whatsapp && (
            <a href={`https://wa.me/966${s.whatsapp.replace(/\D/g, "").replace(/^(966|0)/, "")}`} target="_blank" rel="noopener noreferrer">
              واتساب
            </a>
          )}
        </div>
        <div className="s-footer-col">
          <h4 className="!flex items-center gap-1.5">
            <ShieldCheck size={16} /> ضمان زار
          </h4>
          <span>استرداد كامل حتى {guaranteeDays} يومًا بعد الاستلام</span>
          <span>دفع آمن: مدى، فيزا، Apple Pay</span>
          <span>تقسيط بدون فوائد: تابي وتمارا</span>
        </div>
      </div>
      <div className="s-container s-footer-bottom">
        <span>
          © {new Date().getFullYear()} {store.name}. متجر على منصة{" "}
          <a href="/" className="font-semibold underline underline-offset-4">
            زار
          </a>
        </span>
        <span>
          {s.crNumber && <>س.ت {s.crNumber}</>} {s.vatNumber && <> · الرقم الضريبي {s.vatNumber}</>}
        </span>
      </div>
      <div className="s-footer-giant" aria-hidden>
        <span className="block text-center font-display font-black leading-[1.2]" style={{ fontSize: `${Math.min(26, 96 / Math.max(2, Array.from(store.name).length * 0.72))}vw` }}>
          {store.name}
        </span>
      </div>
    </footer>
  );
}
