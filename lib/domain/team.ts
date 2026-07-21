export const TEAM_ROLES = ["admin", "sales", "recruiter", "hr", "manager", "member", "viewer"] as const;

export const TEAM_ROLE_LABELS: Record<string, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  sales: "Comercial",
  recruiter: "Recrutador",
  hr: "RH",
  manager: "Gestor",
  member: "Membro",
  viewer: "Somente leitura",
};

export function isTeamRole(value: string): value is (typeof TEAM_ROLES)[number] {
  return TEAM_ROLES.includes(value as (typeof TEAM_ROLES)[number]);
}

export function canManageTeam(role: string) {
  return role === "owner" || role === "admin";
}

export function canManageCrm(role: string) {
  return ["owner", "admin", "sales", "manager", "member"].includes(role);
}

export function canManageRecruitment(role: string) {
  return ["owner", "admin", "recruiter", "hr", "manager", "member"].includes(role);
}
