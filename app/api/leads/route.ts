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
  if (name.length < 3 || company.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Revise nome, e-mail e empresa" }, { status: 400 });
  }
  try {
    const { error } = await createAdminClient().from("marketing_leads").insert({
      name, email, company,
      company_size: String(payload.company_size ?? "").trim() || null,
      objective: String(payload.objective ?? "").trim() || null,
      source: "website",
      attribution: payload.attribution ?? {},
    });
    if (error) throw error;
    return NextResponse.json({ success: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Não foi possível registrar o contato" }, { status: 500 });
  }
}
