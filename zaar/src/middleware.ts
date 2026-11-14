import { NextResponse, type NextRequest } from "next/server";
import { HQ_COOKIE, MERCHANT_COOKIE, verifySession } from "@/lib/session";

const ROOT = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
/** مسارات تبقى على المنصة حتى لو فُتحت من نطاق فرعي لمتجر */
const PLATFORM_PATHS = /^\/(api|pay|_next|fonts|favicon|icon|robots|sitemap)/;

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ───── حماية لوحة التاجر ولوحة إدارة زار ─────
  if (pathname.startsWith("/dashboard")) {
    const ok = await verifySession(req.cookies.get(MERCHANT_COOKIE)?.value, "merchant").catch(() => null);
    if (!ok) return redirect(req, "/login");
    return NextResponse.next();
  }
  if (pathname.startsWith("/hq") && pathname !== "/hq/login") {
    const ok = await verifySession(req.cookies.get(HQ_COOKIE)?.value, "hq").catch(() => null);
    if (!ok) return redirect(req, "/hq/login");
    return NextResponse.next();
  }

  // ───── النطاقات الفرعية للمتاجر: متجر.zaar.sa ← /s/متجر ─────
  if (ROOT) {
    const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "").split(":")[0].toLowerCase();
    if (host.endsWith(`.${ROOT}`)) {
      const sub = host.slice(0, -ROOT.length - 1);
      if (sub && sub !== "www" && /^[a-z0-9-]+$/.test(sub) && !PLATFORM_PATHS.test(pathname)) {
        const headers = new Headers(req.headers);
        headers.set("x-zaar-subdomain", sub);
        const url = req.nextUrl.clone();
        url.pathname = pathname.startsWith(`/s/${sub}`) ? pathname : `/s/${sub}${pathname === "/" ? "" : pathname}`;
        return NextResponse.rewrite(url, { request: { headers } });
      }
    }
  }
  // لا نسمح بتزوير الترويسة من الخارج
  if (req.headers.has("x-zaar-subdomain")) {
    const headers = new Headers(req.headers);
    headers.delete("x-zaar-subdomain");
    return NextResponse.next({ request: { headers } });
  }
  return NextResponse.next();
}

function redirect(req: NextRequest, to: string) {
  const url = req.nextUrl.clone();
  url.pathname = to;
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/((?!_next/static|_next/image|fonts/).*)"] };
