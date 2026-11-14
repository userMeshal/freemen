"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { Menu, Search, ShieldCheck, ShoppingBag, X } from "lucide-react";
import { brandUnits } from "../BrandWord";
import { cartCount, useCart } from "../cart";
import { SLink, useHref, useStore } from "../ctx";
import { lockScroll } from "@/components/ui/SmoothScroll";

gsap.registerPlugin(ScrollTrigger, useGSAP);

export type NavLink = { href: string; label: string };

/** الهيدر (من تصميم PUFF): شفاف فوق الواجهة، زجاجي بعد التمرير، يختفي عند النزول ويعود عند الصعود */
export function BoldHeader({ links }: { links: NavLink[] }) {
  const { store } = useStore();
  const href = useHref();
  const pathname = usePathname();
  const items = useCart((s) => s.items);
  const hydrated = useCart((s) => s.hydrated);
  const openCart = useCart((s) => s.open);
  const [hidden, setHidden] = useState(false);
  const [solid, setSolid] = useState(false);
  const [menu, setMenu] = useState(false);
  const lastY = useRef(0);
  const count = hydrated ? cartCount(items) : 0;
  const [bump, setBump] = useState(false);
  const prevCount = useRef(count);
  const announcement = store.content.announcement;

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setSolid(y > 24);
      if (y > 160 && y > lastY.current + 6) setHidden(true);
      else if (y < lastY.current - 6 || y < 160) setHidden(false);
      lastY.current = y;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (count > prevCount.current) {
      setBump(true);
      const t = setTimeout(() => setBump(false), 500);
      prevCount.current = count;
      return () => clearTimeout(t);
    }
    prevCount.current = count;
  }, [count]);

  useEffect(() => setMenu(false), [pathname]);
  useEffect(() => {
    lockScroll(menu);
    return () => lockScroll(false);
  }, [menu]);

  const isActive = (path: string) => {
    const full = href(path.split("?")[0]);
    return path === "/" ? pathname === full : pathname === full || pathname.startsWith(`${full}/`);
  };
  const latin = brandUnits(store.nameLatin, store.name).latin;

  return (
    <>
      <header className={`fixed inset-x-0 top-0 z-[90] transition-transform duration-700 ease-expo ${hidden && !menu ? "-translate-y-full" : "translate-y-0"}`}>
        {announcement && (
          <div className="flex h-[34px] items-center overflow-hidden bg-ink text-xs font-medium text-paper">
            <div className="marquee-track" style={{ ["--marquee-duration" as string]: "38s" }}>
              {[0, 1].map((k) => (
                <div key={k} className="flex shrink-0 items-center" aria-hidden={k === 1 || undefined}>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <span key={i} className="flex items-center whitespace-nowrap">
                      {announcement}
                      <span aria-hidden className="mx-6 inline-block h-1.5 w-1.5 rotate-45 bg-accent" />
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
        <div className={`transition-[background-color,backdrop-filter,border-color] duration-500 ${solid ? "border-b border-line bg-paper/80 backdrop-blur-xl" : "border-b border-transparent bg-transparent"}`}>
          <div className="wrap flex h-[68px] items-center justify-between gap-4">
            <div className="flex items-center gap-2 md:gap-10">
              <button type="button" aria-label="القائمة" onClick={() => setMenu(true)} className="-ms-2 grid h-11 w-11 place-items-center rounded-full transition-colors hover:bg-ink/5 lg:hidden">
                <Menu size={22} />
              </button>
              <SLink href="/" aria-label={`${store.name} — الرئيسية`} className="group flex items-baseline gap-1.5">
                {latin ? (
                  <span dir="ltr" className="font-display text-[1.55rem] font-black leading-none tracking-[-0.06em]">
                    {store.nameLatin.toUpperCase()}
                  </span>
                ) : (
                  <span className="font-display text-[1.5rem] font-black leading-none">{store.name}</span>
                )}
              </SLink>
              <nav aria-label="التنقل الرئيسي" className="hidden items-center gap-7 lg:flex">
                {links.map((l) => (
                  <SLink key={l.href} href={l.href} data-active={isActive(l.href)} className="link-draw text-[0.92rem] font-medium">
                    {l.label}
                  </SLink>
                ))}
              </nav>
            </div>
            <div className="flex items-center gap-0.5 md:gap-1">
              <SLink href="/shop?search=1" aria-label="بحث" className="grid h-11 w-11 place-items-center rounded-full transition-colors hover:bg-ink/5">
                <Search size={20} />
              </SLink>
              <button type="button" aria-label={`السلة (${count})`} onClick={openCart} className="relative -me-2 grid h-11 w-11 place-items-center rounded-full transition-colors hover:bg-ink/5">
                <ShoppingBag size={20} />
                <span
                  className={`num absolute end-0.5 top-0.5 grid h-[1.15rem] min-w-[1.15rem] place-items-center rounded-full bg-ink px-1 font-display text-[0.6rem] font-bold text-accent transition-transform duration-500 ease-expo ${
                    count ? "scale-100" : "scale-0"
                  } ${bump ? "!scale-150" : ""}`}
                >
                  {count}
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* قائمة الجوال */}
      <div
        className={`fixed inset-0 z-[110] flex flex-col bg-ink text-paper transition-[clip-path] duration-700 ease-expo ${menu ? "pointer-events-auto" : "pointer-events-none"}`}
        style={{ clipPath: menu ? "inset(0 0 0 0)" : "inset(0 0 100% 0)" }}
        aria-hidden={!menu}
      >
        <div className="wrap flex h-[68px] items-center justify-between">
          <span className="font-display text-xl font-black">{latin ? store.nameLatin.toUpperCase() : store.name}</span>
          <button type="button" aria-label="إغلاق" onClick={() => setMenu(false)} className="-me-2 grid h-11 w-11 place-items-center rounded-full hover:bg-paper/10">
            <X size={22} />
          </button>
        </div>
        <nav className="wrap flex flex-1 flex-col justify-center gap-1 pb-16">
          {[{ href: "/", label: "الرئيسية" }, ...links, { href: "/track", label: "تتبّع طلبك" }].map((l, i) => (
            <SLink
              key={l.href}
              href={l.href}
              tabIndex={menu ? 0 : -1}
              className="t-h1 block overflow-hidden !text-[clamp(2rem,9vw,3.4rem)]"
              style={{ transform: menu ? "none" : "translateY(40px)", opacity: menu ? 1 : 0, transition: `transform .8s var(--ease-expo) ${0.12 + i * 0.06}s, opacity .6s ${0.12 + i * 0.06}s` }}
            >
              {l.label}
            </SLink>
          ))}
        </nav>
      </div>
    </>
  );
}

/** التذييل (من تصميم PUFF): حروف عملاقة تصعد من القاع مع التمرير */
export function BoldFooter({ links }: { links: NavLink[] }) {
  const root = useRef<HTMLElement>(null);
  const { store, guaranteeDays } = useStore();
  const s = store.settings;
  const { units, latin } = brandUnits(store.nameLatin, store.name);

  useGSAP(
    () => {
      gsap.fromTo(
        ".ft-letter",
        { yPercent: 105 },
        { yPercent: 0, ease: "none", stagger: 0.12, scrollTrigger: { trigger: ".ft-word", start: "top bottom", end: "bottom bottom", scrub: 0.6 } },
      );
    },
    { scope: root },
  );

  const socials = [
    s.instagram && { label: "Instagram", href: `https://instagram.com/${s.instagram.replace(/^@/, "")}` },
    s.tiktok && { label: "TikTok", href: `https://tiktok.com/@${s.tiktok.replace(/^@/, "")}` },
    s.snapchat && { label: "Snapchat", href: `https://snapchat.com/add/${s.snapchat.replace(/^@/, "")}` },
    s.x && { label: "X", href: `https://x.com/${s.x.replace(/^@/, "")}` },
    s.whatsapp && { label: "WhatsApp", href: `https://wa.me/966${s.whatsapp.replace(/\D/g, "").replace(/^(966|0)/, "")}` },
  ].filter(Boolean) as { label: string; href: string }[];

  return (
    <footer ref={root} className="on-ink relative overflow-hidden bg-ink text-paper">
      <div className="wrap grid gap-12 pb-10 pt-16 md:grid-cols-[1.3fr_2fr] md:pt-24">
        <div className="max-w-md">
          <p className="t-h3">{store.content.headline.join(" ")}</p>
          <p className="mt-4 text-sm leading-loose text-paper/60">{store.tagline}</p>
          {s.email && (
            <a href={`mailto:${s.email}`} dir="ltr" className="link-draw mt-6 inline-block font-display text-lg font-semibold text-accent">
              {s.email}
            </a>
          )}
          {socials.length > 0 && (
            <ul className="mt-6 flex flex-wrap gap-2">
              {socials.map((x) => (
                <li key={x.label}>
                  <a href={x.href} target="_blank" rel="noopener noreferrer" className="inline-flex rounded-full border border-paper/25 px-4 py-2 text-xs transition-colors hover:border-accent hover:bg-accent hover:text-on-accent">
                    {x.label}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          <nav aria-label="المتجر">
            <h3 className="t-eyebrow mb-4 text-paper/45">المتجر</h3>
            <ul className="space-y-2.5">
              {links.map((l) => (
                <li key={l.href}>
                  <SLink href={l.href} className="link-draw text-[0.95rem] text-paper/85 hover:text-accent">
                    {l.label}
                  </SLink>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label="المساعدة">
            <h3 className="t-eyebrow mb-4 text-paper/45">المساعدة</h3>
            <ul className="space-y-2.5">
              {[
                { href: "/track", label: "تتبّع طلبك" },
                { href: "/pages/shipping", label: "الشحن والتوصيل" },
                { href: "/pages/returns", label: "الاستبدال والاسترجاع" },
                { href: "/pages/guarantee", label: "ضمان زار" },
              ].map((l) => (
                <li key={l.href}>
                  <SLink href={l.href} className="link-draw text-[0.95rem] text-paper/85 hover:text-accent">
                    {l.label}
                  </SLink>
                </li>
              ))}
            </ul>
          </nav>
          <div className="col-span-2 sm:col-span-1">
            <SLink href="/pages/guarantee" className="block rounded-tile bg-accent p-5 text-on-accent transition-transform duration-500 ease-expo hover:-translate-y-1">
              <ShieldCheck size={26} strokeWidth={1.6} />
              <p className="mt-3 font-display text-base font-extrabold">طلبك مضمون بضمان زار</p>
              <p className="mt-1.5 text-xs leading-relaxed opacity-80">استرداد كامل للمبلغ حتى {guaranteeDays} يومًا بعد الاستلام.</p>
            </SLink>
          </div>
        </div>
      </div>

      <div className="wrap flex flex-wrap items-center justify-between gap-x-8 gap-y-3 border-t border-paper/15 py-5 text-xs text-paper/55">
        <p>
          © {new Date().getFullYear()} {store.name} — متجر على منصة{" "}
          <a href="/" className="font-semibold text-paper/85 hover:text-accent">
            زار
          </a>
        </p>
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          {s.crNumber && (
            <span>
              السجل التجاري <span className="num text-paper/80">{s.crNumber}</span>
            </span>
          )}
          {s.vatNumber && (
            <span>
              الرقم الضريبي <span className="num text-paper/80">{s.vatNumber}</span>
            </span>
          )}
        </div>
        <ul className="flex flex-wrap gap-1.5" aria-label="وسائل الدفع">
          {["مدى", "VISA", "Mastercard", "Apple Pay", "tabby", "tamara"].map((m) => (
            <li key={m} className="rounded-md border border-paper/20 px-2 py-1 font-display text-[0.6rem] font-semibold tracking-wide text-paper/70">
              {m}
            </li>
          ))}
        </ul>
      </div>

      <div className="ft-word select-none overflow-hidden" aria-hidden>
        <div
          dir={latin ? "ltr" : "rtl"}
          className={`flex justify-center font-display font-black text-accent ${latin ? "t-mega" : ""}`}
          style={{ lineHeight: latin ? 0.74 : 1.25, fontSize: latin ? `${Math.min(31.5, 126 / units.length)}vw` : `${Math.min(30, 110 / Math.max(2, Array.from(store.name).length * 0.72))}vw` }}
        >
          {units.map((c, i) => (
            <span key={i} className="ft-letter inline-block will-change-transform">
              {c}
            </span>
          ))}
        </div>
      </div>
    </footer>
  );
}
