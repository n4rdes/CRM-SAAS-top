import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type LeadPayload = { name?: string; email?: string; company?: string; company_size?: string; objective?: string; website?: string; attribution?: Record<string, string> };

export async function POST(request: Request) {
  let payload: LeadPayload;
  try {
    payload = await request.json();
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
  const attribution = Object.fromEntries(["utm_source","utm_medium","utm_campaign","utm_content","utm_term","gclid"].map(key => [key,String(payload.attribution?.[key] ?? "").slice(0,200)]).filter(([,value]) => value));
  try {
    const { error } = await createAdminClient().from("marketing_leads").insert({
      name, email, company,
      company_size: String(payload.company_size ?? "").trim().slice(0,80) || null,
      objective: String(payload.objective ?? "").trim().slice(0,180) || null,
      source: "website",
      attribution,
    });
    if (error) throw error;
    return NextResponse.json({ success: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Não foi possível registrar o contato" }, { status: 500 });
  }
}
