"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { pixel } from "@/lib/pixels";
import { validPixelIds, type PixelIds } from "@/lib/pixel-ids";

function RouteTracker() {
  const pathname = usePathname();
  const search = useSearchParams();
  const first = useRef(true);
  useEffect(() => {
    // التحميل الأول يُسجَّل من سكربت التهيئة نفسه
    if (first.current) {
      first.current = false;
      return;
    }
    pixel.pageView();
  }, [pathname, search]);
  return null;
}

/**
 * يحمّل سكربتات المنصات التي ضُبط معرّفها في لوحة التحكم فقط.
 * المعرّفات تُفحص بصيغتها مرة ثانية هنا قبل وضعها داخل السكربت.
 */
export function Pixels({ ids }: { ids: PixelIds }) {
  const id = validPixelIds(ids);
  const gtagId = id.googleAnalyticsId || id.googleAdsId;
  const any = id.metaPixelId || id.tiktokPixelId || id.snapPixelId || gtagId || id.googleTagManagerId || id.xPixelId || id.pinterestTagId;
  if (!any) return null;

  // ما تحتاجه lib/pixels.ts لمعرفة أي الوجهات مفعّلة (لا أسرار هنا — كلها معرّفات عامة)
  const config = {
    gtag: Boolean(gtagId),
    gtm: Boolean(id.googleTagManagerId),
    adsPurchase: id.googleAdsId && id.googleAdsPurchaseLabel ? `${id.googleAdsId}/${id.googleAdsPurchaseLabel}` : "",
    xPurchase: id.xPixelId ? id.xPurchaseEventId : "",
  };

  return (
    <>
      <Script id="pixels-config" strategy="afterInteractive">
        {`window.__puffPixels=${JSON.stringify(config)};window.dataLayer=window.dataLayer||[];`}
      </Script>
      {id.metaPixelId && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${id.metaPixelId}');fbq('track','PageView');`}
        </Script>
      )}
      {id.tiktokPixelId && (
        <Script id="tiktok-pixel" strategy="afterInteractive">
          {`!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script");n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};ttq.load('${id.tiktokPixelId}');ttq.page();}(window,document,'ttq');`}
        </Script>
      )}
      {id.snapPixelId && (
        <Script id="snap-pixel" strategy="afterInteractive">
          {`(function(e,t,n){if(e.snaptr)return;var a=e.snaptr=function(){a.handleRequest?a.handleRequest.apply(a,arguments):a.queue.push(arguments)};a.queue=[];var s='script',r=t.createElement(s);r.async=!0;r.src=n;var u=t.getElementsByTagName(s)[0];u.parentNode.insertBefore(r,u);})(window,document,'https://sc-static.net/scevent.min.js');snaptr('init','${id.snapPixelId}',{});snaptr('track','PAGE_VIEW');`}
        </Script>
      )}
      {gtagId && (
        <>
          <Script id="gtag-lib" strategy="afterInteractive" src={`https://www.googletagmanager.com/gtag/js?id=${gtagId}`} />
          <Script id="gtag-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());${
              id.googleAnalyticsId ? `gtag('config','${id.googleAnalyticsId}');` : ""
            }${id.googleAdsId ? `gtag('config','${id.googleAdsId}');` : ""}`}
          </Script>
        </>
      )}
      {id.googleTagManagerId && (
        <Script id="gtm" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s);j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${id.googleTagManagerId}');`}
        </Script>
      )}
      {id.xPixelId && (
        <Script id="x-pixel" strategy="afterInteractive">
          {`!function(e,t,n,s,u,a){e.twq||(s=e.twq=function(){s.exe?s.exe.apply(s,arguments):s.queue.push(arguments);},s.version='1.1',s.queue=[],u=t.createElement(n),u.async=!0,u.src='https://static.ads-twitter.com/uwt.js',a=t.getElementsByTagName(n)[0],a.parentNode.insertBefore(u,a))}(window,document,'script');twq('config','${id.xPixelId}');`}
        </Script>
      )}
      {id.pinterestTagId && (
        <Script id="pinterest-tag" strategy="afterInteractive">
          {`!function(e){if(!window.pintrk){window.pintrk=function(){window.pintrk.queue.push(Array.prototype.slice.call(arguments))};var n=window.pintrk;n.queue=[],n.version="3.0";var t=document.createElement("script");t.async=!0,t.src=e;var r=document.getElementsByTagName("script")[0];r.parentNode.insertBefore(t,r)}}("https://s.pinimg.com/ct/core.js");pintrk('load','${id.pinterestTagId}');pintrk('page');`}
        </Script>
      )}
      {/* آخر سكربت: كل المنصات هُيّئت الآن، فتُرسَل الأحداث التي كانت تنتظر (lib/pixels.ts) */}
      <Script id="pixels-ready" strategy="afterInteractive">
        {`window.__puffPixelsReady=true;window.dispatchEvent(new Event('puff:pixels-ready'));`}
      </Script>
      <Suspense fallback={null}>
        <RouteTracker />
      </Suspense>
    </>
  );
}
