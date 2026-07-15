import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "pf_auth";

export function middleware(req: NextRequest) {
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  if (cookie === process.env.APP_PASSWORD) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico).*)"],
};
