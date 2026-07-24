import "server-only";

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  DOCX,
]);

export const MAX_DOCUMENT_SIZE = 8 * 1024 * 1024;

export async function validateDocumentFile(file: File) {
  if (!DOCUMENT_MIME_TYPES.has(file.type)) return false;
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (file.type === "application/pdf") return String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
  if (file.type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (file.type === "image/png") return [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a].every((value, index) => bytes[index] === value);
  if (file.type === DOCX) return bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
  return false;
}

export type MalwareScanResult = {
  status: "not_configured" | "clean" | "infected" | "error";
  provider: string | null;
  reference: string | null;
};

export async function scanDocument(file: File): Promise<MalwareScanResult> {
  const endpoint = process.env.DOCUMENT_SCANNER_URL;
  const required = process.env.DOCUMENT_REQUIRE_MALWARE_SCAN === "true";
  if (!endpoint) {
    if (required) throw new Error("DOCUMENT_SCANNER_NOT_CONFIGURED");
    return { status: "not_configured", provider: null, reference: null };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const form = new FormData();
    form.set("file", file, file.name);
    const response = await fetch(endpoint, {
      method: "POST",
      body: form,
      signal: controller.signal,
      headers: process.env.DOCUMENT_SCANNER_TOKEN
        ? { Authorization: `Bearer ${process.env.DOCUMENT_SCANNER_TOKEN}` }
        : undefined,
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`SCANNER_HTTP_${response.status}`);
    const result = await response.json() as { clean?: boolean; provider?: string; reference?: string };
    return {
      status: result.clean === true ? "clean" : "infected",
      provider: result.provider?.slice(0, 120) ?? new URL(endpoint).hostname,
      reference: result.reference?.slice(0, 300) ?? null,
    };
  } catch (error) {
    console.error("[document-scan] Falha na varredura", error);
    if (required) throw new Error("DOCUMENT_SCAN_FAILED");
    return { status: "error", provider: null, reference: null };
  } finally {
    clearTimeout(timer);
  }
}
