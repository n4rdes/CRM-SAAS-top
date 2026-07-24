const base = (process.env.SMOKE_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const paths = ["/api/health", "/", "/auth/login", "/demo", "/robots.txt"];
let failed = false;
for (const path of paths) {
  try {
    const response = await fetch(`${base}${path}`, { redirect: "manual", signal: AbortSignal.timeout(10_000) });
    const ok = response.status >= 200 && response.status < 400;
    console.log(`${ok ? "OK" : "FAIL"} ${response.status} ${path}`);
    if (!ok) failed = true;
  } catch (error) {
    console.error(`FAIL ${path}`, error instanceof Error ? error.message : error);
    failed = true;
  }
}
if (failed) process.exit(1);
