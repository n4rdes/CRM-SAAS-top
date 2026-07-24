import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRequestFingerprint } from "@/lib/security/request";
import { consumeRateLimit } from "@/lib/security/rate-limit";

type LeadPayload = {
  name?: string;
  email?: string;
  company?: string;
  company_size?: string;
  objective?: string;
  website?: string;
  attribution?: Record<string, string>;
};

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 32_768) return NextResponse.json({ error: "Dados muito grandes" }, { status: 413 });

  const fingerprint = createRequestFingerprint(request.headers, "marketing-lead");
  let rate;
  try {
    rate = await consumeRateLimit({ scope: "marketing-leads", keyHash: fingerprint, limit: 5, windowSeconds: 15 * 60 });
  } catch {
    return NextResponse.json({ error: "Proteção temporariamente indisponível" }, { status: 503 });
  }
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde alguns minutos." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  let payload: LeadPayload;
  try {
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, "utf8") > 32_768) {
      return NextResponse.json({ error: "Dados muito grandes" }, { status: 413 });
    }
    payload = JSON.parse(rawBody) as LeadPayload;
  } catch {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }
  if (payload.website) return NextResponse.json({ success: true });

  const name = String(payload.name ?? "").trim();
  const email = String(payload.email ?? "").trim().toLowerCase();
  const company = String(payload.company ?? "").trim();
  if (name.length < 3 || name.length > 180 || email.length > 254 || company.length < 2 || company.length > 180 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Revise nome, e-mail e empresa" }, { status: 400 });
  }

  const attribution = Object.fromEntries(
    ["utm_source","utm_medium","utm_campaign","utm_content","utm_term","gclid"]
      .map(key => [key, String(payload.attribution?.[key] ?? "").slice(0, 200)])
      .filter(([, value]) => value),
  );

  try {
    const { error } = await createAdminClient().from("marketing_leads").insert({
      name,
      email,
      company,
      company_size: String(payload.company_size ?? "").trim().slice(0, 80) || null,
      objective: String(payload.objective ?? "").trim().slice(0, 180) || null,
      source: "website",
      attribution,
    });
    if (error) throw error;
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("[marketing-leads] Falha ao registrar lead", error);
    return NextResponse.json({ error: "Não foi possível registrar o contato" }, { status: 500 });
  }
}
