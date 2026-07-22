export const AUTOMATION_EVENTS = ["leave_requested", "employee_created", "candidate_hired"] as const;
export const AUTOMATION_ACTIONS = ["create_activity", "notify_team"] as const;

export type AutomationEvent = (typeof AUTOMATION_EVENTS)[number];
export type AutomationAction = (typeof AUTOMATION_ACTIONS)[number];

export const AUTOMATION_EVENT_LABELS: Record<AutomationEvent, string> = {
  leave_requested: "Ausência solicitada",
  employee_created: "Colaborador criado",
  candidate_hired: "Candidato contratado",
};

export const AUTOMATION_ACTION_LABELS: Record<AutomationAction, string> = {
  create_activity: "Criar atividade",
  notify_team: "Notificar responsáveis",
};

export function isAutomationEvent(value: string): value is AutomationEvent {
  return AUTOMATION_EVENTS.includes(value as AutomationEvent);
}

export function isAutomationAction(value: string): value is AutomationAction {
  return AUTOMATION_ACTIONS.includes(value as AutomationAction);
}

export function automationSummary(event: AutomationEvent, action: AutomationAction) {
  return `Quando ${AUTOMATION_EVENT_LABELS[event].toLowerCase()}, ${AUTOMATION_ACTION_LABELS[action].toLowerCase()}.`;
}

export function normalizeDueDays(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(90, Math.trunc(value)));
}
