export const SURVEY_KINDS = ["enps", "pulse", "climate", "custom"] as const;
export const SURVEY_STATUSES = ["draft", "active", "closed", "canceled"] as const;
export const QUESTION_TYPES = ["enps", "scale", "text", "single_choice"] as const;
export const ENGAGEMENT_CATEGORIES = ["enps", "leadership", "wellbeing", "career", "belonging", "recognition", "communication", "custom"] as const;
export const ACTION_PLAN_STATUSES = ["planned", "in_progress", "completed", "canceled"] as const;
export const RECOGNITION_VALUES = ["collaboration", "ownership", "customer", "innovation", "results", "culture"] as const;

export const SURVEY_KIND_LABELS: Record<(typeof SURVEY_KINDS)[number], string> = {
  enps: "eNPS",
  pulse: "Pulso rápido",
  climate: "Pesquisa de clima",
  custom: "Personalizada",
};

export const SURVEY_STATUS_LABELS: Record<(typeof SURVEY_STATUSES)[number], string> = {
  draft: "Rascunho",
  active: "Coletando respostas",
  closed: "Encerrada",
  canceled: "Cancelada",
};

export const QUESTION_TYPE_LABELS: Record<(typeof QUESTION_TYPES)[number], string> = {
  enps: "eNPS · escala 0–10",
  scale: "Escala 1–5",
  text: "Resposta aberta",
  single_choice: "Escolha única",
};

export const ENGAGEMENT_CATEGORY_LABELS: Record<(typeof ENGAGEMENT_CATEGORIES)[number], string> = {
  enps: "eNPS",
  leadership: "Liderança",
  wellbeing: "Bem-estar",
  career: "Carreira",
  belonging: "Pertencimento",
  recognition: "Reconhecimento",
  communication: "Comunicação",
  custom: "Outro",
};

export const ACTION_PLAN_STATUS_LABELS: Record<(typeof ACTION_PLAN_STATUSES)[number], string> = {
  planned: "Planejado",
  in_progress: "Em andamento",
  completed: "Concluído",
  canceled: "Cancelado",
};

export const RECOGNITION_VALUE_LABELS: Record<(typeof RECOGNITION_VALUES)[number], string> = {
  collaboration: "Colaboração",
  ownership: "Senso de dono",
  customer: "Foco no cliente",
  innovation: "Inovação",
  results: "Resultados",
  culture: "Cultura",
};

export function isSurveyKind(value: string): value is (typeof SURVEY_KINDS)[number] {
  return SURVEY_KINDS.includes(value as (typeof SURVEY_KINDS)[number]);
}

export function isQuestionType(value: string): value is (typeof QUESTION_TYPES)[number] {
  return QUESTION_TYPES.includes(value as (typeof QUESTION_TYPES)[number]);
}

export function isEngagementCategory(value: string): value is (typeof ENGAGEMENT_CATEGORIES)[number] {
  return ENGAGEMENT_CATEGORIES.includes(value as (typeof ENGAGEMENT_CATEGORIES)[number]);
}

export function isActionPlanStatus(value: string): value is (typeof ACTION_PLAN_STATUSES)[number] {
  return ACTION_PLAN_STATUSES.includes(value as (typeof ACTION_PLAN_STATUSES)[number]);
}

export function isRecognitionValue(value: string): value is (typeof RECOGNITION_VALUES)[number] {
  return RECOGNITION_VALUES.includes(value as (typeof RECOGNITION_VALUES)[number]);
}

export function enpsLabel(score: number | null) {
  if (score === null) return "Aguardando respostas";
  if (score >= 75) return "Zona de excelência";
  if (score >= 50) return "Zona de qualidade";
  if (score >= 0) return "Zona de aperfeiçoamento";
  return "Zona crítica";
}
