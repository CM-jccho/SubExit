import { NextRequest, NextResponse } from "next/server";

const CANONICAL_HOST = "speakcoaching-one.vercel.app";
const LEGACY_PERSONAL_HOST = "speakcoaching.vercel.app";

export function middleware(request: NextRequest) {
  const host = (request.headers.get("host") || "").split(":")[0].toLowerCase();
  if (host !== LEGACY_PERSONAL_HOST) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.protocol = "https:";
  url.hostname = CANONICAL_HOST;
  url.port = "";
  return NextResponse.redirect(url, 308);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
