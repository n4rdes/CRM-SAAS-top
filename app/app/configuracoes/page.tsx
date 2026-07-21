import { SubmitButton } from "../_components/submit-button";
import { updateProfile, updateTenantSettings } from "./actions";
import { requireWorkspace } from "@/lib/auth/workspace";
import { canManageTeam, TEAM_ROLE_LABELS } from "@/lib/domain/team";

const TIMEZONE_LABELS: Record<string, string> = {
  "America/Sao_Paulo": "Brasília / São Paulo",
  "America/Manaus": "Manaus",
  "America/Recife": "Recife",
  "America/Fortaleza": "Fortaleza",
  "America/Cuiaba": "Cuiabá",
};

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const params = await searchParams;
  const { supabase, user, tenant, membership } = await requireWorkspace();
  const [{ data: profile }, { data: company }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).single(),
    supabase.from("tenants").select("name,slug,document,phone,timezone").eq("id", tenant.id).single(),
  ]);
  const manager = canManageTeam(membership.role);

  return <div className="workspace-content">
    <div className="page-heading"><div><h1>Configurações</h1><p>Dados da sua conta e identificação do ambiente.</p></div><span className="status-badge">{TEAM_ROLE_LABELS[membership.role] ?? membership.role}</span></div>
    {params.error && <div className="notice error-notice">{params.error}</div>}
    {params.success && <div className="notice">{params.success}</div>}
    <div className="settings-grid">
      <article className="panel"><h2>Seu perfil</h2><p>Informações exibidas para os outros membros da equipe.</p><form className="record-form" action={updateProfile}><label>Nome completo<input name="full_name" defaultValue={profile?.full_name ?? ""} required /></label><label>E-mail<input value={user.email ?? ""} disabled readOnly /></label><SubmitButton>Salvar perfil</SubmitButton></form></article>
      <article className="panel"><h2>Empresa</h2><p>Identificação usada no ambiente e nos documentos da assinatura.</p>{manager ? <form className="record-form" action={updateTenantSettings}><label>Razão social ou nome da empresa<input name="name" defaultValue={company?.name ?? tenant.name} required /></label><label>CNPJ / documento<input name="document" defaultValue={company?.document ?? ""} /></label><label>Telefone<input name="phone" defaultValue={company?.phone ?? ""} /></label><label>Fuso horário<select name="timezone" defaultValue={company?.timezone ?? "America/Sao_Paulo"}>{Object.entries(TIMEZONE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><SubmitButton>Salvar empresa</SubmitButton></form> : <div className="settings-readonly"><dl><div><dt>Empresa</dt><dd>{company?.name ?? tenant.name}</dd></div><div><dt>Identificador</dt><dd>{company?.slug}</dd></div><div><dt>Fuso</dt><dd>{TIMEZONE_LABELS[company?.timezone ?? "America/Sao_Paulo"]}</dd></div></dl><small>Somente proprietários e administradores podem editar.</small></div>}</article>
    </div>
  </div>;
}
