export const LEAVE_TYPES = ["vacation", "sick", "personal", "parental", "unpaid", "compensatory", "other"] as const;
export const LEAVE_STATUSES = ["pending", "approved", "rejected", "canceled"] as const;
export const PARTIAL_DAY_OPTIONS = ["full", "morning", "afternoon"] as const;

export type LeaveType = (typeof LEAVE_TYPES)[number];
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];
export type PartialDay = (typeof PARTIAL_DAY_OPTIONS)[number];

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  vacation: "Férias",
  sick: "Licença médica",
  personal: "Ausência pessoal",
  parental: "Licença parental",
  unpaid: "Licença não remunerada",
  compensatory: "Folga compensatória",
  other: "Outra ausência",
};

export const LEAVE_STATUS_LABELS: Record<LeaveStatus, string> = {
  pending: "Aguardando aprovação",
  approved: "Aprovada",
  rejected: "Rejeitada",
  canceled: "Cancelada",
};

export const PARTIAL_DAY_LABELS: Record<PartialDay, string> = {
  full: "Dia inteiro",
  morning: "Somente manhã",
  afternoon: "Somente tarde",
};

export function isLeaveType(value: string): value is LeaveType {
  return LEAVE_TYPES.includes(value as LeaveType);
}

export function isLeaveStatus(value: string): value is LeaveStatus {
  return LEAVE_STATUSES.includes(value as LeaveStatus);
}

export function isPartialDay(value: string): value is PartialDay {
  return PARTIAL_DAY_OPTIONS.includes(value as PartialDay);
}

export function calculateBusinessDays(start: string | Date, end: string | Date, partialDay: PartialDay = "full") {
  const first = new Date(typeof start === "string" ? `${start}T12:00:00` : start);
  const last = new Date(typeof end === "string" ? `${end}T12:00:00` : end);
  if (Number.isNaN(first.getTime()) || Number.isNaN(last.getTime()) || last < first) return 0;

  let total = 0;
  const cursor = new Date(first);
  while (cursor <= last) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) total += 1;
    cursor.setDate(cursor.getDate() + 1);
  }

  if (partialDay !== "full" && first.toDateString() === last.toDateString() && total === 1) return 0.5;
  return total;
}

export function formatLeaveDays(value: number) {
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value)} ${value === 1 ? "dia" : "dias"}`;
}
