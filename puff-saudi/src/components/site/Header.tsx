"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, Search, ShoppingBag, User } from "lucide-react";
import { TLink } from "./Transition";
import { cartCount, useCart } from "@/store/cart";
import { useUI } from "@/store/ui";

export type NavLink = { href: string; label: string; latin?: string };

export function Header({ links, announcement = "" }: { links: NavLink[]; announcement?: string }) {
  const pathname = usePathname();
  const items = useCart((s) => s.items);
  const hydrated = useCart((s) => s.hydrated);
  const openCart = useCart((s) => s.open);
  const setMenu = useUI((s) => s.setMenu);
  const setSearch = useUI((s) => s.setSearch);
  const [hidden, setHidden] = useState(false);
  const [solid, setSolid] = useState(false);
  const lastY = useRef(0);
  const count = hydrated ? cartCount(items) : 0;
  const [bump, setBump] = useState(false);
  const prevCount = useRef(count);

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

  const isActive = (href: string) => {
    const path = href.split("?")[0];
    return path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`);
  };

  return (
    <header
      className={`fixed inset-x-0 top-0 z-[90] transition-transform duration-700 ease-expo ${
        hidden ? "-translate-y-full" : "translate-y-0"
      }`}
    >
      {announcement && (
        <div className="flex h-[34px] items-center overflow-hidden bg-ink text-xs font-medium text-paper">
          <div className="marquee-track" style={{ ["--marquee-duration" as string]: "38s" }}>
            {[0, 1].map((k) => (
              <div key={k} className="flex shrink-0 items-center" aria-hidden={k === 1 || undefined}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <span key={i} className="flex items-center whitespace-nowrap">
                    {announcement}
                    <span aria-hidden className="mx-6 inline-block h-1.5 w-1.5 rotate-45 bg-lime" />
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
      <div
        className={`transition-[background-color,backdrop-filter,border-color] duration-500 ${
          solid ? "border-b border-line bg-paper/80 backdrop-blur-xl" : "border-b border-transparent bg-transparent"
        }`}
      >
        <div className="wrap flex h-[68px] items-center justify-between gap-4">
          {/* البداية: القائمة (جوال) + الشعار */}
          <div className="flex items-center gap-2 md:gap-10">
            <button
              type="button"
              aria-label="القائمة"
              onClick={() => setMenu(true)}
              className="-ms-2 grid h-11 w-11 place-items-center rounded-full transition-colors hover:bg-ink/5 lg:hidden"
            >
              <Menu size={22} />
            </button>
            <TLink href="/" aria-label="PUFF SAUDI — الرئيسية" className="group flex items-baseline gap-1.5" dir="ltr">
              <span className="font-display text-[1.55rem] font-black leading-none tracking-[-0.06em]">PUFF</span>
              <span className="hidden font-display text-[0.55rem] font-semibold tracking-[0.3em] text-ink-mute transition-colors group-hover:text-ink sm:inline">
                SAUDI
              </span>
            </TLink>
            <nav aria-label="التنقل الرئيسي" className="hidden items-center gap-7 lg:flex">
              {links.map((l) => (
                <TLink
                  key={l.href}
                  href={l.href}
                  data-active={isActive(l.href)}
                  className="link-draw text-[0.92rem] font-medium"
                >
                  {l.label}
                </TLink>
              ))}
            </nav>
          </div>

          {/* النهاية: بحث، حساب، سلة */}
          <div className="flex items-center gap-0.5 md:gap-1">
            <button
              type="button"
              aria-label="بحث"
              onClick={() => setSearch(true)}
              className="grid h-11 w-11 place-items-center rounded-full transition-colors hover:bg-ink/5"
            >
              <Search size={20} />
            </button>
            <TLink
              href="/account"
              aria-label="حسابي"
              className="hidden h-11 w-11 place-items-center rounded-full transition-colors hover:bg-ink/5 sm:grid"
            >
              <User size={20} />
            </TLink>
            <button
              type="button"
              aria-label={`السلة (${count})`}
              onClick={openCart}
              className="relative -me-2 grid h-11 w-11 place-items-center rounded-full transition-colors hover:bg-ink/5"
            >
              <ShoppingBag size={20} />
              <span
                className={`num absolute end-0.5 top-0.5 grid h-[1.15rem] min-w-[1.15rem] place-items-center rounded-full bg-ink px-1 font-display text-[0.6rem] font-bold text-lime transition-transform duration-500 ease-expo ${
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
  );
}
