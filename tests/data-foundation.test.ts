import { describe, expect, it } from "vitest";
import { normalizeHeader, normalizeImportRow, parseDelimitedText } from "../lib/domain/data-foundation";

describe("data foundation imports", () => {
  it("detecta CSV com ponto e vírgula e aspas", () => {
    const parsed = parseDelimitedText('Nome;Email;Telefone\n"Maria da Silva";maria@example.com;47999999999');
    expect(parsed.headers).toEqual(["nome", "email", "telefone"]);
    expect(parsed.rows[0]).toMatchObject({ nome: "Maria da Silva", email: "maria@example.com" });
  });

  it("normaliza cabeçalhos em português", () => {
    expect(normalizeHeader("Data de Admissão")).toBe("data_de_admissao");
  });

  it("valida dados mínimos por entidade", () => {
    expect(normalizeImportRow("candidate", { nome: "João Teste", email: "joao@example.com" }).errors).toEqual([]);
    expect(normalizeImportRow("candidate", { nome: "J", email: "inválido" }).errors).toHaveLength(2);
    expect(normalizeImportRow("job", { titulo: "Analista de RH" }).normalized.title).toBe("Analista de RH");
  });
});
