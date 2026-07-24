import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function databaseHealth() {
  const check = createAdminClient().from("plans").select("id", { count: "exact", head: true });
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("HEALTHCHECK_TIMEOUT")), 3_000);
  });
  try {
    const { error } = await Promise.race([check, timeout]);
    if (error) throw error;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export async function GET() {
  const startedAt = performance.now();
  try {
    await databaseHealth();
    return NextResponse.json(
      {
        status: "ok",
        database: "reachable",
        version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? process.env.APP_VERSION ?? "local",
        responseTimeMs: Math.round(performance.now() - startedAt),
        checkedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("[health] Dependência indisponível", error instanceof Error ? error.message : error);
    return NextResponse.json(
      {
        status: "degraded",
        database: "unreachable",
        responseTimeMs: Math.round(performance.now() - startedAt),
        checkedAt: new Date().toISOString(),
      },
      { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
}
