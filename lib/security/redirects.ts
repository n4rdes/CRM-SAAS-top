export function safeInternalPath(value: string | null | undefined, fallback = "/app") {
  const candidate = value?.trim() || fallback;
  if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) return fallback;
  return candidate;
}
