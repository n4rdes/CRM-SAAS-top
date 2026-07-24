import { describe, expect, it } from "vitest";
import { calculateBusinessDays, formatLeaveDays, isLeaveStatus, isLeaveType, isPartialDay } from "../lib/domain/time-off";

describe("time-off domain", () => {
  it("conta somente dias úteis em um intervalo", () => {
    expect(calculateBusinessDays("2026-07-20", "2026-07-24")).toBe(5);
    expect(calculateBusinessDays("2026-07-24", "2026-07-27")).toBe(2);
    expect(calculateBusinessDays("2026-07-25", "2026-07-26")).toBe(0);
  });

  it("calcula meio período e rejeita intervalo invertido", () => {
    expect(calculateBusinessDays("2026-07-22", "2026-07-22", "morning")).toBe(0.5);
    expect(calculateBusinessDays("2026-07-23", "2026-07-22")).toBe(0);
  });

  it("valida enums recebidos por formulários", () => {
    expect(isLeaveType("vacation")).toBe(true);
    expect(isLeaveType("holiday")).toBe(false);
    expect(isLeaveStatus("approved")).toBe(true);
    expect(isPartialDay("afternoon")).toBe(true);
  });

  it("formata singular e fracionário em pt-BR", () => {
    expect(formatLeaveDays(1)).toBe("1 dia");
    expect(formatLeaveDays(1.5)).toBe("1,5 dias");
  });
});
