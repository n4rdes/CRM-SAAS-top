import { describe, expect, it } from "vitest";
import { automationSummary, isAutomationAction, isAutomationEvent, normalizeDueDays } from "../lib/domain/automations";

describe("automation domain", () => {
  it("valida eventos e ações permitidos", () => {
    expect(isAutomationEvent("candidate_hired")).toBe(true);
    expect(isAutomationEvent("delete_everything")).toBe(false);
    expect(isAutomationAction("notify_team")).toBe(true);
    expect(isAutomationAction("arbitrary_sql")).toBe(false);
  });

  it("gera uma descrição humana do fluxo", () => {
    expect(automationSummary("leave_requested", "notify_team")).toBe("Quando ausência solicitada, notificar responsáveis.");
  });

  it("normaliza prazos dentro do limite seguro", () => {
    expect(normalizeDueDays(-4)).toBe(0);
    expect(normalizeDueDays(3.9)).toBe(3);
    expect(normalizeDueDays(200)).toBe(90);
    expect(normalizeDueDays(Number.NaN)).toBe(0);
  });
});
