import { readdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const directory = new URL("../supabase/migrations/", import.meta.url);
const files = (await readdir(directory)).filter(file => file.endsWith(".sql")).sort();
if (!files.length) throw new Error("Nenhuma migration encontrada.");

const versions = files.map(file => file.split("_")[0]);
if (new Set(versions).size !== versions.length) throw new Error("Existem versões de migration duplicadas.");
if (versions.some((version, index) => index > 0 && version <= versions[index - 1])) {
  throw new Error("As migrations não estão em ordem crescente.");
}

for (const file of files) {
  const sql = await readFile(new URL(file, directory), "utf8");
  if (!sql.trim()) throw new Error(`Migration vazia: ${file}`);
  if (/drop\s+(table|schema)\s+(?!if\s+exists)/i.test(sql)) {
    throw new Error(`Operação destrutiva sem IF EXISTS detectada em ${file}`);
  }
}

console.log(`Migrations locais válidas: ${files.length} (${versions[0]} → ${versions.at(-1)}).`);

if (process.env.VERIFY_REMOTE_MIGRATIONS === "1") {
  const command = process.platform === "win32" ? "supabase.exe" : "supabase";
  const result = spawnSync(command, ["migration", "list", "--linked"], { stdio: "inherit", shell: false });
  if (result.error?.code === "ENOENT") throw new Error("Supabase CLI não encontrado para verificar o banco remoto.");
  if (result.status !== 0) throw new Error("A lista de migrations remotas diverge ou não pôde ser verificada.");
}
