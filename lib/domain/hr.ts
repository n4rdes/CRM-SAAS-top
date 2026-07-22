export const COMPANY_STAGES = ["lead", "qualified", "proposal", "customer", "inactive"] as const;
export const JOB_STATUSES = ["draft", "open", "paused", "closed", "canceled"] as const;
export const APPLICATION_STAGES = ["applied", "screening", "interview", "assessment", "offer", "hired", "rejected", "withdrawn"] as const;
export const ACTIVITY_TYPES = ["task", "call", "email", "meeting", "interview", "follow_up", "note"] as const;
export const REVIEW_RECOMMENDATIONS = ["strong_no", "no", "neutral", "yes", "strong_yes"] as const;

export const COMPANY_STAGE_LABELS: Record<(typeof COMPANY_STAGES)[number], string> = {
  lead: "Lead",
  qualified: "Qualificado",
  proposal: "Proposta",
  customer: "Cliente",
  inactive: "Inativo",
};

export const JOB_STATUS_LABELS: Record<(typeof JOB_STATUSES)[number], string> = {
  draft: "Rascunho",
  open: "Aberta",
  paused: "Pausada",
  closed: "Encerrada",
  canceled: "Cancelada",
};

export const APPLICATION_STAGE_LABELS: Record<(typeof APPLICATION_STAGES)[number], string> = {
  applied: "Inscrito",
  screening: "Triagem",
  interview: "Entrevista",
  assessment: "Avaliação",
  offer: "Proposta",
  hired: "Contratado",
  rejected: "Reprovado",
  withdrawn: "Desistiu",
};

export const ACTIVITY_TYPE_LABELS: Record<(typeof ACTIVITY_TYPES)[number], string> = {
  task: "Tarefa",
  call: "Ligação",
  email: "E-mail",
  meeting: "Reunião",
  interview: "Entrevista",
  follow_up: "Follow-up",
  note: "Nota",
};

export const REVIEW_RECOMMENDATION_LABELS: Record<(typeof REVIEW_RECOMMENDATIONS)[number], string> = {
  strong_no: "Não recomendo",
  no: "Tende a não",
  neutral: "Neutro",
  yes: "Recomendo",
  strong_yes: "Recomendo muito",
};

export function isCompanyStage(value: string): value is (typeof COMPANY_STAGES)[number] {
  return COMPANY_STAGES.includes(value as (typeof COMPANY_STAGES)[number]);
}

export function isJobStatus(value: string): value is (typeof JOB_STATUSES)[number] {
  return JOB_STATUSES.includes(value as (typeof JOB_STATUSES)[number]);
}

export function isApplicationStage(value: string): value is (typeof APPLICATION_STAGES)[number] {
  return APPLICATION_STAGES.includes(value as (typeof APPLICATION_STAGES)[number]);
}

export function isActivityType(value: string): value is (typeof ACTIVITY_TYPES)[number] {
  return ACTIVITY_TYPES.includes(value as (typeof ACTIVITY_TYPES)[number]);
}

export function isReviewRecommendation(value: string): value is (typeof REVIEW_RECOMMENDATIONS)[number] {
  return REVIEW_RECOMMENDATIONS.includes(value as (typeof REVIEW_RECOMMENDATIONS)[number]);
}
