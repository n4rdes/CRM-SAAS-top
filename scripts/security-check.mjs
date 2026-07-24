import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const forbidden = [
  ".env.local",
  ".env.local.backup",
  ".env.production",
  ".env.production.local",
];

const { stdout } = await execFileAsync(
  "git",
  ["ls-files", "--", ...forbidden],
  { windowsHide: true },
);

const trackedSensitiveFiles = stdout
  .split(/\r?\n/)
  .map((file) => file.trim())
  .filter(Boolean);

if (trackedSensitiveFiles.length > 0) {
  throw new Error(
    `Arquivos sensíveis rastreados pelo Git: ${trackedSensitiveFiles.join(", ")}`,
  );
}

const auth = await readFile("app/auth/actions.ts", "utf8");
if (/x-forwarded-host|headers\(\).*host/s.test(auth)) throw new Error("Callbacks de autenticação ainda dependem de Host/X-Forwarded-Host.");
const layout = await readFile("app/app/layout.tsx", "utf8");
if (layout.includes("reconcileTenantSubscription")) throw new Error("A Stripe ainda é consultada durante a renderização do layout.");
const webhook = await readFile("app/api/stripe/webhook/route.ts", "utf8");
if (!webhook.includes("claim_billing_webhook_event")) throw new Error("Webhook Stripe sem caixa transacional.");
console.log("Verificações estáticas de segurança concluídas.");
