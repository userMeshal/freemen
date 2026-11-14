"use client";

import { useEffect, type CSSProperties, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { MotionConfig } from "motion/react";
import { Cursor } from "@/components/ui/Cursor";
import { SmoothScroll } from "@/components/ui/SmoothScroll";
import { hexTriplet } from "@/lib/color";
import type { CategoryDTO, StoreDTO } from "@/lib/types";
import { BoldFooter, BoldHeader } from "./bold/Chrome";
import { Preloader } from "./bold/Preloader";
import { TransitionProvider } from "./bold/Transition";
import { CartDrawer } from "./CartDrawer";
import { StoreProvider } from "./ctx";
import { SoftFooter, SoftNav } from "./soft/Chrome";
import { track } from "./track";

/** يغلّف كل صفحات المتجر: يحقن لوحة الألوان، ويركّب هيكل الثيم (هيدر، تذييل، سلة، انتقالات) */
export function StoreShell({
  store,
  categories,
  guaranteeDays,
  banner,
  children,
}: {
  store: StoreDTO;
  categories: CategoryDTO[];
  guaranteeDays: number;
  banner?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const p = store.palette;
  const links = [{ href: "/shop", label: "كل المنتجات" }, ...categories.filter((c) => c.count > 0).slice(0, 4).map((c) => ({ href: `/shop?cat=${c.slug}`, label: c.name }))];

  useEffect(() => {
    track.view(store.slug);
  }, [pathname, store.slug]);

  const accentVars = { "--accent": hexTriplet(p.accent), "--on-accent": hexTriplet(p.onAccent) } as CSSProperties;

  if (store.theme === "soft") {
    const vars = {
      ...accentVars,
      "--orb-a": p.orbs[0],
      "--orb-b": p.orbs[1],
      "--orb-c": p.orbs[2],
    } as CSSProperties;
    return (
      <StoreProvider value={{ store, categories, guaranteeDays }}>
        <div className="t-soft" data-mode={p.dark ? "dark" : "light"} style={vars} suppressHydrationWarning>
          <script
            dangerouslySetInnerHTML={{
              __html: `try{var m=localStorage.getItem('zaar-mode:${store.slug}');if(m)document.currentScript.parentElement.dataset.mode=m}catch(e){}`,
            }}
          />
          <MotionConfig reducedMotion="user">
            {banner}
            <SoftNav links={links} />
            <main id="main">{children}</main>
            <SoftFooter links={links} />
            <CartDrawer />
          </MotionConfig>
        </div>
      </StoreProvider>
    );
  }

  const vars = {
    ...accentVars,
    "--ink": hexTriplet(p.ink),
    "--paper": hexTriplet(p.paper),
    "--header-h": store.content.announcement ? "102px" : "68px",
  } as CSSProperties;
  return (
    <StoreProvider value={{ store, categories, guaranteeDays }}>
      <div className="t-bold" style={vars}>
        <Preloader slug={store.slug} name={store.name} nameLatin={store.nameLatin} />
        <TransitionProvider name={store.name} nameLatin={store.nameLatin}>
          <SmoothScroll />
          <Cursor />
          {banner}
          <BoldHeader links={links} />
          <main id="main" className="relative">
            {children}
          </main>
          <BoldFooter links={links} />
          <CartDrawer />
        </TransitionProvider>
      </div>
    </StoreProvider>
  );
}
