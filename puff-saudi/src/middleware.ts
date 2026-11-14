import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, verifySession } from "@/lib/session";

/** حماية لوحة التحكم: أي مسار تحت /admin (عدا صفحة الدخول) يتطلب جلسة مدير صالحة */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/admin/login") return NextResponse.next();
  const session = await verifySession(req.cookies.get(ADMIN_COOKIE)?.value, "admin").catch(() => null);
  if (!session) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*", "/api/admin/:path*"] };
