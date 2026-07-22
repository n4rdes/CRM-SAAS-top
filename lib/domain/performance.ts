export const PERFORMANCE_CYCLE_STATUSES = ["draft", "active", "calibration", "closed", "canceled"] as const;
export const GOAL_CATEGORIES = ["company", "team", "individual", "development"] as const;
export const GOAL_STATUSES = ["draft", "in_progress", "at_risk", "completed", "canceled"] as const;
export const REVIEW_TYPES = ["manager", "hr", "peer"] as const;
export const REVIEW_STATUSES = ["draft", "submitted", "acknowledged"] as const;

export const PERFORMANCE_CYCLE_STATUS_LABELS: Record<(typeof PERFORMANCE_CYCLE_STATUSES)[number], string> = {
  draft: "Rascunho",
  active: "Em andamento",
  calibration: "Calibração",
  closed: "Encerrado",
  canceled: "Cancelado",
};

export const GOAL_CATEGORY_LABELS: Record<(typeof GOAL_CATEGORIES)[number], string> = {
  company: "Empresa",
  team: "Equipe",
  individual: "Individual",
  development: "Desenvolvimento",
};

export const GOAL_STATUS_LABELS: Record<(typeof GOAL_STATUSES)[number], string> = {
  draft: "Rascunho",
  in_progress: "Em andamento",
  at_risk: "Em risco",
  completed: "Concluída",
  canceled: "Cancelada",
};

export const REVIEW_TYPE_LABELS: Record<(typeof REVIEW_TYPES)[number], string> = {
  manager: "Gestor",
  hr: "RH",
  peer: "Par",
};

export const REVIEW_STATUS_LABELS: Record<(typeof REVIEW_STATUSES)[number], string> = {
  draft: "Pendente",
  submitted: "Enviada",
  acknowledged: "Ciente",
};

export function isPerformanceCycleStatus(value: string): value is (typeof PERFORMANCE_CYCLE_STATUSES)[number] {
  return PERFORMANCE_CYCLE_STATUSES.includes(value as (typeof PERFORMANCE_CYCLE_STATUSES)[number]);
}

export function isGoalCategory(value: string): value is (typeof GOAL_CATEGORIES)[number] {
  return GOAL_CATEGORIES.includes(value as (typeof GOAL_CATEGORIES)[number]);
}

export function isGoalStatus(value: string): value is (typeof GOAL_STATUSES)[number] {
  return GOAL_STATUSES.includes(value as (typeof GOAL_STATUSES)[number]);
}

export function isReviewType(value: string): value is (typeof REVIEW_TYPES)[number] {
  return REVIEW_TYPES.includes(value as (typeof REVIEW_TYPES)[number]);
}

export function ratingLabel(value: number | null) {
  if (!value) return "Sem avaliação";
  if (value >= 4.5) return "Excepcional";
  if (value >= 3.5) return "Acima do esperado";
  if (value >= 2.5) return "Dentro do esperado";
  if (value >= 1.5) return "Precisa evoluir";
  return "Atenção imediata";
}
