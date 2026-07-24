import { NextResponse } from "next/server";
import { getAppUrl } from "@/lib/http/app-url";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return NextResponse.json({ error: "Documento inválido" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/auth/login", getAppUrl()));

  const { data, error } = await supabase.rpc("register_employee_document_download", {
    p_document_id: id,
    p_require_clean: process.env.DOCUMENT_REQUIRE_MALWARE_SCAN === "true",
  });
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row?.storage_path) {
    const status = error?.message.includes("ACCESS_DENIED") ? 403 : error?.message.includes("QUARANTINED") ? 423 : 404;
    return NextResponse.json({ error: status === 423 ? "Documento em quarentena" : "Documento indisponível" }, { status });
  }

  const { data: signed, error: signedError } = await createAdminClient().storage
    .from("employee-documents")
    .createSignedUrl(row.storage_path, 60, { download: row.file_name });
  if (signedError || !signed?.signedUrl) {
    return NextResponse.json({ error: "Não foi possível gerar o download seguro" }, { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl, {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Referrer-Policy": "no-referrer",
    },
  });
}
