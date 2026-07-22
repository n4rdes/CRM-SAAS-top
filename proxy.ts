import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isPublicRoute = pathname === "/" || pathname === "/demo" || pathname === "/robots.txt" || pathname === "/sitemap.xml" || pathname.startsWith("/api/leads") || pathname.startsWith("/api/stripe/webhook") || pathname.startsWith("/pesquisa/");
  if (isPublicRoute) return NextResponse.next();
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
