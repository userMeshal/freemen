import Script from "next/script";

const digits = (v: string) => (/^\d{5,20}$/.test(v) ? v : "");
const alnum = (v: string) => (/^[A-Za-z0-9-]{5,40}$/.test(v) ? v : "");

/** بكسلات التتبع — المعرّفات تُتحقق من صيغتها قبل الحقن */
export function Pixels({ meta, tiktok, snap }: { meta: string; tiktok: string; snap: string }) {
  const m = digits(meta);
  const t = alnum(tiktok);
  const s = alnum(snap);
  return (
    <>
      {m && (
        <Script id="px-meta" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${m}');fbq('track','PageView');`}
        </Script>
      )}
      {t && (
        <Script id="px-tiktok" strategy="afterInteractive">
          {`!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.load=function(e){var n="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=n;ttq._t=ttq._t||{};ttq._t[e]=+new Date;var o=d.createElement("script");o.type="text/javascript";o.async=!0;o.src=n+"?sdkid="+e+"&lib="+t;var a=d.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${t}');ttq.page();}(window,document,'ttq');`}
        </Script>
      )}
      {s && (
        <Script id="px-snap" strategy="afterInteractive">
          {`(function(e,t,n){if(e.snaptr)return;var a=e.snaptr=function(){a.handleRequest?a.handleRequest.apply(a,arguments):a.queue.push(arguments)};a.queue=[];var s='script';var r=t.createElement(s);r.async=!0;r.src=n;var u=t.getElementsByTagName(s)[0];u.parentNode.insertBefore(r,u);})(window,document,'https://sc-static.net/scevent.min.js');snaptr('init','${s}');snaptr('track','PAGE_VIEW');`}
        </Script>
      )}
    </>
  );
}
