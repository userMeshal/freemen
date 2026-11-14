"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import clsx from "clsx";
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  FolderTree,
  Users,
  TicketPercent,
  Truck,
  FileText,
  Settings,
  Menu,
  X,
  ExternalLink,
  LogOut,
} from "lucide-react";

const NAV = [
  { href: "/admin", label: "الرئيسية", icon: LayoutDashboard, exact: true },
  { href: "/admin/orders", label: "الطلبات", icon: ShoppingBag },
  { href: "/admin/products", label: "المنتجات", icon: Package },
  { href: "/admin/categories", label: "التصنيفات", icon: FolderTree },
  { href: "/admin/customers", label: "العملاء", icon: Users },
  { href: "/admin/coupons", label: "الكوبونات", icon: TicketPercent },
  { href: "/admin/shipping", label: "الشحن", icon: Truck },
  { href: "/admin/pages", label: "الصفحات", icon: FileText },
  { href: "/admin/settings", label: "الإعدادات", icon: Settings },
];

export function AdminShell({
  adminName,
  adminEmail,
  logoutAction,
  children,
}: {
  adminName: string;
  adminEmail: string;
  logoutAction: () => Promise<void>;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  const nav = (
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="أقسام لوحة التحكم">
      {NAV.map((item) => {
        const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition",
              active ? "bg-lime text-ink" : "text-paper/75 hover:bg-white/10 hover:text-paper",
            )}
          >
            <Icon className="h-[18px] w-[18px] shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const brand = (
    <div className="flex items-center justify-between px-6 py-5">
      <Link href="/admin" className="font-display text-2xl font-black tracking-tight text-lime" dir="ltr">
        PUFF
      </Link>
      <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold text-paper/70">لوحة التحكم</span>
    </div>
  );

  const footer = (
    <div className="border-t border-white/10 p-4">
      <div className="mb-3 px-2">
        <div className="truncate text-sm font-semibold text-paper">{adminName}</div>
        <div className="truncate text-xs text-paper/50" dir="ltr" style={{ textAlign: "right" }}>
          {adminEmail}
        </div>
      </div>
      <form action={logoutAction}>
        <button
          type="submit"
          className="flex w-full items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold text-paper/75 transition hover:bg-white/10 hover:text-paper"
        >
          <LogOut className="h-4 w-4" /> تسجيل الخروج
        </button>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen bg-paper font-body text-ink">
      {/* الشريط الجانبي — سطح المكتب */}
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-64 flex-col bg-ink lg:flex">
        {brand}
        {nav}
        {footer}
      </aside>

      {/* الشريط الجانبي — الجوال */}
      <div
        className={clsx("fixed inset-0 z-40 bg-ink/50 transition-opacity lg:hidden", open ? "opacity-100" : "pointer-events-none opacity-0")}
        onClick={() => setOpen(false)}
        aria-hidden
      />
      <aside
        className={clsx(
          "fixed inset-y-0 start-0 z-50 flex w-72 max-w-[85vw] flex-col bg-ink transition-transform duration-300 ease-expo lg:hidden",
          open ? "translate-x-0" : "ltr:-translate-x-full rtl:translate-x-full",
        )}
        aria-hidden={!open}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="absolute end-3 top-4 rounded-lg p-2 text-paper/70 hover:bg-white/10"
          aria-label="إغلاق القائمة"
        >
          <X className="h-5 w-5" />
        </button>
        {brand}
        {nav}
        {footer}
      </aside>

      <div className="lg:ps-64">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-paper/90 px-4 py-3 backdrop-blur md:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="rounded-xl border border-line bg-white p-2 lg:hidden"
              aria-label="فتح القائمة"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="text-sm text-ink-mute">
              أهلًا، <strong className="font-semibold text-ink">{adminName}</strong>
            </span>
          </div>
          <Link
            href="/"
            target="_blank"
            className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-3.5 py-2 text-xs font-semibold text-ink transition hover:border-ink"
          >
            عرض المتجر <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
