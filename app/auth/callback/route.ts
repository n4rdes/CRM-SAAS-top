import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/http/app-url";
import { safeInternalPath } from "@/lib/security/redirects";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeInternalPath(url.searchParams.get("next"));
  const appUrl = getAppUrl();

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, appUrl));
  }

  return NextResponse.redirect(new URL("/auth/login?error=Não foi possível validar o link.", appUrl));
}
