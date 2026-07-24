import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";

async function exists(path) {
  try { await access(path, constants.F_OK); return true; } catch { return false; }
}

const forbidden = [".env.local", ".env.local.backup", ".env.production", ".env.production.local"];
const found = [];
for (const file of forbidden) if (await exists(file)) found.push(file);
if (found.length) throw new Error(`Arquivos sensíveis presentes no pacote: ${found.join(", ")}`);

const auth = await readFile("app/auth/actions.ts", "utf8");
if (/x-forwarded-host|headers\(\).*host/s.test(auth)) throw new Error("Callbacks de autenticação ainda dependem de Host/X-Forwarded-Host.");
const layout = await readFile("app/app/layout.tsx", "utf8");
if (layout.includes("reconcileTenantSubscription")) throw new Error("A Stripe ainda é consultada durante a renderização do layout.");
const webhook = await readFile("app/api/stripe/webhook/route.ts", "utf8");
if (!webhook.includes("claim_billing_webhook_event")) throw new Error("Webhook Stripe sem caixa transacional.");
console.log("Verificações estáticas de segurança concluídas.");
