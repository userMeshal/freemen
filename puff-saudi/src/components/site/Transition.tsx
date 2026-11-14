"use client";

import Link, { type LinkProps } from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  createContext,
  forwardRef,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type AnchorHTMLAttributes,
  type MouseEvent,
} from "react";
import gsap from "gsap";

/**
 * انتقالات الصفحات: ستارة حبرية تصعد من الأسفل وعليها كلمة PUFF، ثم تنكشف الصفحة الجديدة للأعلى.
 * كل الروابط الداخلية تستخدم <TLink>.
 */
type Ctx = { navigate: (href: string) => void };
const TransitionCtx = createContext<Ctx>({ navigate: () => {} });
export const usePageTransition = () => useContext(TransitionCtx);

function RouteWatcher({ onChange }: { onChange: () => void }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const key = `${pathname}?${search}`;
  const prev = useRef(key);
  useEffect(() => {
    if (prev.current !== key) {
      prev.current = key;
      onChange();
    }
  }, [key, onChange]);
  return null;
}

export function TransitionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const curtain = useRef<HTMLDivElement>(null);
  const letters = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const covered = useRef(false);
  const failsafe = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reveal = useCallback(() => {
    if (!covered.current) return;
    covered.current = false;
    if (failsafe.current) clearTimeout(failsafe.current);
    const el = curtain.current;
    if (!el) return;
    window.scrollTo(0, 0);
    gsap
      .timeline({
        defaults: { ease: "expo.inOut" },
        onComplete: () => {
          busy.current = false;
          gsap.set(el, { visibility: "hidden", pointerEvents: "none" });
          window.dispatchEvent(new Event("puff:page-ready"));
        },
      })
      .to(letters.current!.children, { yPercent: -120, duration: 0.5, stagger: 0.04, ease: "expo.in" }, 0.05)
      .to(el, { clipPath: "inset(0% 0% 100% 0%)", duration: 0.75 }, 0.2);
  }, []);

  const navigate = useCallback(
    (href: string) => {
      if (busy.current) return;
      const el = curtain.current;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const target = new URL(href, window.location.href);
      const same = target.pathname === window.location.pathname && target.search === window.location.search;
      if (!el || reduce || same) {
        router.push(href);
        return;
      }
      busy.current = true;
      router.prefetch(href);
      gsap.set(el, { visibility: "visible", pointerEvents: "auto", clipPath: "inset(100% 0% 0% 0%)" });
      gsap.set(letters.current!.children, { yPercent: 120 });
      gsap
        .timeline({
          defaults: { ease: "expo.inOut" },
          onComplete: () => {
            covered.current = true;
            router.push(href);
            // احتياط: لو تأخر التنقل لأي سبب نكشف الصفحة على أي حال
            failsafe.current = setTimeout(reveal, 6000);
          },
        })
        .to(el, { clipPath: "inset(0% 0% 0% 0%)", duration: 0.6 })
        .to(letters.current!.children, { yPercent: 0, duration: 0.6, stagger: 0.045, ease: "expo.out" }, 0.2);
    },
    [router, reveal],
  );

  // الرجوع/التقدم بالمتصفح: لا نغطي، فقط نتأكد أن الستارة مخفية
  useEffect(() => {
    const onPop = () => {
      if (busy.current) {
        covered.current = true;
        reveal();
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [reveal]);

  return (
    <TransitionCtx.Provider value={{ navigate }}>
      {children}
      <Suspense fallback={null}>
        <RouteWatcher onChange={reveal} />
      </Suspense>
      <div
        ref={curtain}
        aria-hidden
        className="fixed inset-0 z-[150] grid place-items-center bg-ink text-lime"
        style={{ visibility: "hidden", pointerEvents: "none", clipPath: "inset(100% 0% 0% 0%)" }}
      >
        <div
          ref={letters}
          dir="ltr"
          className="t-mega flex overflow-hidden text-[clamp(4rem,22vw,20rem)]"
          style={{ lineHeight: 0.9 }}
        >
          {"PUFF".split("").map((c, i) => (
            <span key={i} className="inline-block">
              {c}
            </span>
          ))}
        </div>
      </div>
    </TransitionCtx.Provider>
  );
}

type TLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> &
  Pick<LinkProps, "prefetch" | "replace"> & { href: string };

export const TLink = forwardRef<HTMLAnchorElement, TLinkProps>(function TLink({ href, onClick, ...rest }, ref) {
  const { navigate } = usePageTransition();
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (
      e.defaultPrevented ||
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey ||
      rest.target === "_blank" ||
      !href.startsWith("/") ||
      href.startsWith("/#")
    )
      return;
    e.preventDefault();
    navigate(href);
  };
  return <Link ref={ref} href={href} onClick={handle} {...rest} />;
});
