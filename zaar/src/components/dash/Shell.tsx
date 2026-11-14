"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  BadgePercent, ExternalLink, LayoutDashboard, LogOut, Menu, MessageSquareHeart, Package, Palette, Settings, ShieldCheck, ShoppingCart,
  Sparkles, Star, Users, Wallet, X, Banknote, Store, type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: string; badge?: number };

const ICONS: Record<string, LucideIcon> = {
  home: LayoutDashboard, orders: ShoppingCart, products: Package, coupons: BadgePercent, customers: Users, carts: MessageSquareHeart,
  wallet: Wallet, claims: ShieldCheck, reviews: Star, design: Palette, assistant: Sparkles, settings: Settings, payouts: Banknote, stores: Store,
};

/** هيكل لوحة التحكم: شريط جانبي حبري ثابت على سطح المكتب، ودرج على الجوال */
export function Shell({
  nav,
  brand,
  sub,
  storeUrl,
  logoutAction,
  children,
}: {
  nav: NavItem[];
  brand: string;
  sub: string;
  storeUrl?: string;
  logoutAction: () => Promise<void>;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  const root = nav[0]?.href ?? "/";
  const active = (href: string) => (href === root ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));

  const side = (
    <div className="flex h-full flex-col bg-ink text-paper">
      <div className="flex items-center justify-between gap-3 px-5 pb-4 pt-6">
        <Link href={root} className="min-w-0">
          <span className="block font-display text-2xl font-black leading-none">زار</span>
          <span className="mt-2 block truncate text-sm font-semibold text-accent">{brand}</span>
          <span className="block truncate text-xs text-paper/45">{sub}</span>
        </Link>
        <button type="button" className="grid h-10 w-10 place-items-center rounded-full hover:bg-paper/10 lg:hidden" onClick={() => setOpen(false)} aria-label="إغلاق">
          <X size={20} />
        </button>
      </div>
      <nav className="no-scrollbar flex-1 space-y-0.5 overflow-y-auto px-3 py-2" aria-label="لوحة التحكم">
        {nav.map((n) => {
          const I = ICONS[n.icon] ?? LayoutDashboard;
          const on = active(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-[0.92rem] transition-colors ${
                on ? "bg-accent font-semibold text-on-accent" : "text-paper/75 hover:bg-paper/10 hover:text-paper"
              }`}
            >
              <I size={18} strokeWidth={1.8} />
              <span className="flex-1">{n.label}</span>
              {n.badge ? (
                <span className={`num grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[0.68rem] font-bold ${on ? "bg-ink text-accent" : "bg-accent text-on-accent"}`}>
                  {n.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
      <div className="space-y-1 border-t border-paper/10 p-3">
        {storeUrl && (
          <a href={storeUrl} target="_blank" rel="noopener" className="flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm text-paper/75 hover:bg-paper/10 hover:text-paper">
            <ExternalLink size={17} /> عرض المتجر
          </a>
        )}
        <form action={logoutAction}>
          <button type="submit" className="flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm text-paper/60 hover:bg-paper/10 hover:text-paper">
            <LogOut size={17} /> تسجيل الخروج
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-paper text-ink">
      <aside className="fixed inset-y-0 start-0 z-40 hidden w-64 lg:block">{side}</aside>
      {open && <div className="fixed inset-0 z-40 bg-ink/50 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)} />}
      <aside className={`fixed inset-y-0 start-0 z-50 w-72 transition-transform duration-500 ease-expo lg:hidden ${open ? "translate-x-0" : "translate-x-full"}`}>{side}</aside>

      <div className="lg:ps-64">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-ink/10 bg-paper/85 px-4 backdrop-blur-xl lg:hidden">
          <button type="button" className="-ms-2 grid h-10 w-10 place-items-center rounded-full hover:bg-ink/5" onClick={() => setOpen(true)} aria-label="القائمة">
            <Menu size={21} />
          </button>
          <span className="truncate font-display text-sm font-bold">{brand}</span>
          <span className="font-display text-lg font-black">زار</span>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-10">{children}</main>
      </div>
    </div>
  );
}
