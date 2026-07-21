export const COMPANY_STAGES = ["lead", "qualified", "proposal", "customer", "inactive"] as const;
export const JOB_STATUSES = ["draft", "open", "paused", "closed", "canceled"] as const;
export const APPLICATION_STAGES = ["applied", "screening", "interview", "assessment", "offer", "hired", "rejected", "withdrawn"] as const;

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

export function isCompanyStage(value: string): value is (typeof COMPANY_STAGES)[number] {
  return COMPANY_STAGES.includes(value as (typeof COMPANY_STAGES)[number]);
}

export function isJobStatus(value: string): value is (typeof JOB_STATUSES)[number] {
  return JOB_STATUSES.includes(value as (typeof JOB_STATUSES)[number]);
}

export function isApplicationStage(value: string): value is (typeof APPLICATION_STAGES)[number] {
  return APPLICATION_STAGES.includes(value as (typeof APPLICATION_STAGES)[number]);
}
