import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export async function consumeRateLimit(input: {
  scope: string;
  keyHash: string;
  limit: number;
  windowSeconds: number;
}): Promise<RateLimitResult> {
  const { data, error } = await createAdminClient().rpc("consume_api_rate_limit", {
    p_scope: input.scope,
    p_key_hash: input.keyHash,
    p_limit: input.limit,
    p_window_seconds: input.windowSeconds,
  });

  if (error) {
    console.error("[rate-limit] Falha ao consultar limite distribuído", input.scope, error.message);
    throw new Error("RATE_LIMIT_UNAVAILABLE");
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    allowed: Boolean(row?.allowed),
    remaining: Number(row?.remaining ?? 0),
    retryAfterSeconds: Math.max(1, Number(row?.retry_after_seconds ?? input.windowSeconds)),
  };
}
