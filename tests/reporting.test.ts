import { describe, expect, it } from "vitest";
import { normalizeReportPeriod, rowsToCsv, sanitizeColumns, sanitizeDashboardCards, sanitizeReportCards } from "../lib/domain/reporting";

describe("customizable analytics", () => {
  it("remove cards inválidos e repetidos", () => {
    expect(sanitizeDashboardCards(["clients", "clients", "bad", "time_off"])).toEqual(["clients", "time_off"]);
    expect(sanitizeReportCards(["commercial", "time_off", "commercial"])).toEqual(["commercial", "time_off"]);
  });

  it("recupera o conjunto padrão quando nenhum card válido é enviado", () => {
    expect(sanitizeDashboardCards([]).length).toBeGreaterThan(4);
    expect(sanitizeReportCards(["invalid"]).length).toBeGreaterThan(4);
  });

  it("normaliza colunas e intervalo de datas", () => {
    expect(sanitizeColumns(3, 1, 4, 2)).toBe(3);
    expect(sanitizeColumns(9, 1, 4, 2)).toBe(2);
    expect(normalizeReportPeriod("2026-07-01", "2026-07-22")).toEqual({ from: "2026-07-01", to: "2026-07-22" });
    expect(normalizeReportPeriod("2026-07-30", "2026-07-22")).toEqual({ from: "2026-07-22", to: "2026-07-22" });
  });

  it("gera CSV compatível com planilhas e neutraliza fórmulas", () => {
    const csv = rowsToCsv([["Nome", "Valor"], ["Empresa", "=2+2"], ["Aspas", "A \"B\""]]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("\"'=2+2\"");
    expect(csv).toContain("\"A \"\"B\"\"\"");
    expect(csv).toContain(";");
  });
});
