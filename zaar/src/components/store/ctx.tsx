"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, forwardRef, useContext, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from "react";
import type { CategoryDTO, StoreDTO } from "@/lib/types";

type StoreCtx = { store: StoreDTO; categories: CategoryDTO[]; guaranteeDays: number };
const Ctx = createContext<StoreCtx | null>(null);

export function StoreProvider({ value, children }: { value: StoreCtx; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): StoreCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore خارج StoreProvider");
  return v;
}

/** رابط داخل المتجر: يضيف بادئة المتجر (/s/slug على الدومين الرئيسي، لا شيء على النطاق الفرعي) */
export function useHref() {
  const { store } = useStore();
  return (path: string) => (path === "/" ? store.base || "/" : `${store.base}${path}`);
}

// ───── انتقال الصفحات: الثيم الجريء يوفّر ستارة، وغيره يتنقل مباشرة ─────
type Nav = { navigate: (href: string) => void } | null;
export const TransitionCtx = createContext<Nav>(null);

export function useNavigate() {
  const t = useContext(TransitionCtx);
  const router = useRouter();
  return (href: string) => (t ? t.navigate(href) : router.push(href));
}

type SLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string; prefetch?: boolean };

/** رابط متجر: مسار نسبي للمتجر مثل "/shop" أو "/p/p-1" */
export const SLink = forwardRef<HTMLAnchorElement, SLinkProps>(function SLink({ href, onClick, ...rest }, ref) {
  const to = useHref()(href);
  const t = useContext(TransitionCtx);
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (!t || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || rest.target === "_blank") return;
    e.preventDefault();
    t.navigate(to);
  };
  return <Link ref={ref} href={to} onClick={handle} {...rest} />;
});
