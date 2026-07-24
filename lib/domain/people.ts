export const EMPLOYEE_STATUSES = ["preboarding", "active", "on_leave", "terminated"] as const;
export const EMPLOYMENT_TYPES = ["employee", "contractor", "intern", "temporary", "partner"] as const;
export const WORK_MODELS = ["onsite", "hybrid", "remote"] as const;
export const WORKFLOW_KINDS = ["onboarding", "offboarding"] as const;
export const DOCUMENT_CATEGORIES = ["identity", "contract", "medical", "payroll", "certificate", "other"] as const;

export const EMPLOYEE_STATUS_LABELS: Record<(typeof EMPLOYEE_STATUSES)[number], string> = {
  preboarding: "Pré-admissão",
  active: "Ativo",
  on_leave: "Afastado",
  terminated: "Desligado",
};

export const EMPLOYMENT_TYPE_LABELS: Record<(typeof EMPLOYMENT_TYPES)[number], string> = {
  employee: "CLT / empregado",
  contractor: "Prestador / PJ",
  intern: "Estagiário",
  temporary: "Temporário",
  partner: "Sócio",
};

export const WORK_MODEL_LABELS: Record<(typeof WORK_MODELS)[number], string> = {
  onsite: "Presencial",
  hybrid: "Híbrido",
  remote: "Remoto",
};

export const WORKFLOW_KIND_LABELS: Record<(typeof WORKFLOW_KINDS)[number], string> = {
  onboarding: "Onboarding",
  offboarding: "Offboarding",
};

export const DOCUMENT_CATEGORY_LABELS: Record<(typeof DOCUMENT_CATEGORIES)[number], string> = {
  identity: "Identificação",
  contract: "Contrato",
  medical: "Médico",
  payroll: "Folha / financeiro",
  certificate: "Certificado",
  other: "Outro",
};

export function isEmployeeStatus(value: string): value is (typeof EMPLOYEE_STATUSES)[number] {
  return EMPLOYEE_STATUSES.includes(value as (typeof EMPLOYEE_STATUSES)[number]);
}

export function isEmploymentType(value: string): value is (typeof EMPLOYMENT_TYPES)[number] {
  return EMPLOYMENT_TYPES.includes(value as (typeof EMPLOYMENT_TYPES)[number]);
}

export function isWorkModel(value: string): value is (typeof WORK_MODELS)[number] {
  return WORK_MODELS.includes(value as (typeof WORK_MODELS)[number]);
}

export function isWorkflowKind(value: string): value is (typeof WORKFLOW_KINDS)[number] {
  return WORKFLOW_KINDS.includes(value as (typeof WORKFLOW_KINDS)[number]);
}

export function isDocumentCategory(value: string): value is (typeof DOCUMENT_CATEGORIES)[number] {
  return DOCUMENT_CATEGORIES.includes(value as (typeof DOCUMENT_CATEGORIES)[number]);
}
