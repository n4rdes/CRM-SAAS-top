import "server-only";
import { createHmac } from "node:crypto";

function firstAddress(value: string | null) {
  return value?.split(",")[0]?.trim() || null;
}

export function getClientAddress(headers: Pick<Headers, "get">) {
  if (process.env.VERCEL === "1") {
    return firstAddress(headers.get("x-vercel-forwarded-for")) ?? firstAddress(headers.get("x-real-ip")) ?? "unknown";
  }
  if (process.env.CF_PAGES === "1") return firstAddress(headers.get("cf-connecting-ip")) ?? "unknown";
  if (process.env.FLY_APP_NAME) return firstAddress(headers.get("fly-client-ip")) ?? "unknown";
  if (process.env.TRUST_PROXY === "true") {
    return firstAddress(headers.get("x-forwarded-for"))
      ?? firstAddress(headers.get("x-real-ip"))
      ?? firstAddress(headers.get("true-client-ip"))
      ?? "unknown";
  }
  return "unknown";
}

function rateLimitSecret() {
  const secret = process.env.RATE_LIMIT_SECRET ?? process.env.SUPABASE_SECRET_KEY;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") throw new Error("RATE_LIMIT_SECRET_NOT_CONFIGURED");
  return "prismae-local-rate-limit-secret";
}

export function createRequestFingerprint(headers: Pick<Headers, "get">, discriminator = "") {
  const address = getClientAddress(headers);
  const userAgent = (headers.get("user-agent") ?? "unknown").slice(0, 500);
  return createHmac("sha256", rateLimitSecret())
    .update(`${address}\n${userAgent}\n${discriminator}`)
    .digest("hex");
}
