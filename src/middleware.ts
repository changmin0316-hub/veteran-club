import { NextRequest, NextResponse } from "next/server";
import { sessionOptions } from "@/lib/session";

// 경량 게이트: 세션 쿠키 유무로 1차 차단하고,
// 실제 유효성/권한 검증은 각 서버 레이아웃의 getCurrentUser()가 담당.
const PUBLIC_PATHS = ["/login"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = req.cookies.has(sessionOptions.cookieName);

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!hasSession && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (hasSession && pathname === "/login") {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // 정적 파일/이미지/API 제외
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
