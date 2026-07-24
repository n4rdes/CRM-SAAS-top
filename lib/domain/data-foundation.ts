export const DATA_ENTITY_TYPES = ["candidate", "company", "job", "employee"] as const;
export type DataEntityType = (typeof DATA_ENTITY_TYPES)[number];

export const DATA_ENTITY_LABELS: Record<DataEntityType, string> = {
  candidate: "Candidatos",
  company: "Clientes",
  job: "Vagas",
  employee: "Colaboradores",
};

export const CUSTOM_FIELD_TYPES = ["text", "long_text", "number", "currency", "date", "boolean", "single_select", "multi_select", "email", "phone", "url"] as const;
export const CUSTOM_FIELD_TYPE_LABELS: Record<(typeof CUSTOM_FIELD_TYPES)[number], string> = {
  text: "Texto curto", long_text: "Texto longo", number: "Número", currency: "Moeda", date: "Data",
  boolean: "Sim / não", single_select: "Seleção única", multi_select: "Seleção múltipla", email: "E-mail", phone: "Telefone", url: "URL",
};

export function isDataEntityType(value: string): value is DataEntityType {
  return DATA_ENTITY_TYPES.includes(value as DataEntityType);
}

export function parseDelimitedText(content: string) {
  const normalized = content.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const firstLine = normalized.split("\n", 1)[0] ?? "";
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    const next = normalized[index + 1];
    if (char === '"' && quoted && next === '"') { value += '"'; index += 1; continue; }
    if (char === '"') { quoted = !quoted; continue; }
    if (char === delimiter && !quoted) { row.push(value.trim()); value = ""; continue; }
    if (char === "\n" && !quoted) { row.push(value.trim()); if (row.some(Boolean)) rows.push(row); row = []; value = ""; continue; }
    value += char;
  }
  row.push(value.trim());
  if (row.some(Boolean)) rows.push(row);
  if (rows.length < 2) return { headers: rows[0] ?? [], rows: [] as Record<string, string>[] };
  const headers = rows[0].map((header, index) => normalizeHeader(header || `coluna_${index + 1}`));
  return { headers, rows: rows.slice(1).map(columns => Object.fromEntries(headers.map((header, index) => [header, columns[index] ?? ""]))) };
}

export function normalizeHeader(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

const aliases: Record<DataEntityType, Record<string, string[]>> = {
  candidate: { full_name: ["nome", "nome_completo", "candidato"], email: ["email", "e_mail"], phone: ["telefone", "celular", "whatsapp"], source: ["origem", "fonte"] },
  company: { name: ["nome", "empresa", "razao_social", "cliente"], document: ["cnpj", "documento"], email: ["email", "e_mail"], phone: ["telefone", "celular"], stage: ["etapa", "status"] },
  job: { title: ["titulo", "vaga", "cargo"], description: ["descricao", "responsabilidades"], openings: ["posicoes", "vagas", "quantidade"], status: ["status", "situacao"] },
  employee: { full_name: ["nome", "nome_completo", "colaborador"], email: ["email", "email_corporativo", "email_pessoal"], phone: ["telefone", "celular"], hire_date: ["admissao", "data_admissao", "hire_date"] },
};

export function normalizeImportRow(entityType: DataEntityType, row: Record<string, string>) {
  const normalized: Record<string, string> = {};
  for (const [field, candidates] of Object.entries(aliases[entityType])) {
    const key = [field, ...candidates].find(candidate => Object.prototype.hasOwnProperty.call(row, candidate));
    normalized[field] = key ? String(row[key] ?? "").trim() : "";
  }
  const errors: string[] = [];
  if (["candidate", "employee"].includes(entityType) && (normalized.full_name?.length ?? 0) < 3) errors.push("Nome obrigatório");
  if (entityType === "candidate" && !/^\S+@\S+\.\S+$/.test(normalized.email ?? "")) errors.push("E-mail inválido");
  if (entityType === "company" && (normalized.name?.length ?? 0) < 2) errors.push("Nome da empresa obrigatório");
  if (entityType === "job" && (normalized.title?.length ?? 0) < 2) errors.push("Título da vaga obrigatório");
  if (normalized.hire_date && Number.isNaN(new Date(normalized.hire_date).getTime())) errors.push("Data de admissão inválida");
  return { normalized, errors };
}
