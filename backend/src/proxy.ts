import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/shared/auth/session";

const PUBLIC_PAGES = new Set(["/impressum", "/datenschutz", "/agb"]);

// Gate every page (Next 16 "proxy", formerly middleware). API routes will do their own 401/403 handling in Phase 3.
export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);

  // /login always renders. A signed cookie doesn't prove the account is still active (it may have been
  // deactivated or deleted), so the login page itself checks the database and forwards only active users.
  if (pathname === "/login") return NextResponse.next();
  // The legal pages are for customers: the app links to them, so they must open without a dashboard login.
  if (PUBLIC_PAGES.has(pathname)) return NextResponse.next();
  if (!session) {
    const url = new URL("/login", req.url);
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    const res = NextResponse.redirect(url);
    if (req.cookies.has(SESSION_COOKIE)) res.cookies.delete(SESSION_COOKIE); // drop invalid/expired cookie
    return res;
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
