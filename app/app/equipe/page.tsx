import { CopyButton } from "../_components/copy-button";
import { ConfirmButton } from "../_components/confirm-button";
import { SubmitButton } from "../_components/submit-button";
import { cancelTeamInvitation, createTeamInvitation, removeTeamMember, updateMemberRole } from "./actions";
import { requireWorkspace } from "@/lib/auth/workspace";
import { canManageTeam, TEAM_ROLES, TEAM_ROLE_LABELS } from "@/lib/domain/team";
import { getAppUrl } from "@/lib/billing/config";

type Profile = { id: string; full_name: string | null };

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string; token?: string }> }) {
  const params = await searchParams;
  const { supabase, tenant, user, membership } = await requireWorkspace();
  const manager = canManageTeam(membership.role);
  const [membersResult, invitationsResult, subscriptionResult] = await Promise.all([
    supabase.from("memberships").select("id,user_id,role,created_at").eq("tenant_id", tenant.id).order("created_at"),
    manager ? supabase.from("tenant_invitations").select("id,email,role,status,token,expires_at,created_at").eq("tenant_id", tenant.id).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
    supabase.from("subscriptions").select("plan:plans(name,limits)").eq("tenant_id", tenant.id).single(),
  ]);
  const members = membersResult.data ?? [];
  const userIds = members.map(item => item.user_id);
  const { data: profiles } = userIds.length ? await supabase.from("profiles").select("id,full_name").in("id", userIds) : { data: [] as Profile[] };
  const profileMap = new Map((profiles as Profile[] | null ?? []).map(profile => [profile.id, profile]));
  const plan = subscriptionResult.data?.plan as unknown as { name?: string; limits?: { users?: number | null } } | null;
  const userLimit = plan?.limits?.users;
  const inviteLink = params.token ? `${getAppUrl()}/convite/${params.token}` : null;
  const activeInvitations = (invitationsResult.data ?? []).filter(item => item.status === "pending" && new Date(item.expires_at) > new Date());

  return <div className="workspace-content">
    <div className="page-heading"><div><h1>Equipe e acessos</h1><p>Controle quem entra no ambiente e o que cada pessoa pode fazer.</p></div><span className="record-count">{members.length}{typeof userLimit === "number" ? `/${userLimit}` : ""} usuários · {plan?.name ?? "Basic"}</span></div>
    {params.error && <div className="notice error-notice">{params.error}</div>}
    {params.success && <div className="notice">{params.success}</div>}
    {inviteLink && <div className="invite-link-box"><div><strong>Link de convite</strong><code>{inviteLink}</code></div><CopyButton value={inviteLink} /></div>}
    <div className="team-layout">
      {manager && <article className="panel sticky-panel"><h2>Convidar pessoa</h2><p>O convite expira em 7 dias e só funciona para o e-mail informado.</p><form className="record-form" action={createTeamInvitation}><label>E-mail profissional<input name="email" type="email" required /></label><label>Função<select name="role" defaultValue="recruiter">{TEAM_ROLES.filter(role => membership.role === "owner" || role !== "admin").map(role => <option key={role} value={role}>{TEAM_ROLE_LABELS[role]}</option>)}</select></label><SubmitButton pendingLabel="Criando convite...">Gerar convite</SubmitButton></form></article>}
      <div className="detail-stack team-main">
        <article className="panel"><div className="panel-heading"><div><h2>Membros</h2><p>{members.length} pessoa(s) com acesso a {tenant.name}.</p></div></div><div className="member-list">{members.map(item => { const profile = profileMap.get(item.user_id); const isOwner = item.role === "owner"; return <div className="member-row" key={item.id}><div className="member-avatar">{(profile?.full_name ?? (item.user_id === user.id ? user.email : "U") ?? "U").slice(0, 1).toUpperCase()}</div><div className="member-identity"><strong>{profile?.full_name ?? (item.user_id === user.id ? "Você" : "Usuário")}</strong><small>{item.user_id === user.id ? user.email : `Entrou em ${new Date(item.created_at).toLocaleDateString("pt-BR")}`}</small></div>{manager && !isOwner && item.user_id !== user.id ? <><form className="role-form" action={updateMemberRole}><input type="hidden" name="membership_id" value={item.id} /><select name="role" defaultValue={item.role}>{TEAM_ROLES.filter(role => membership.role === "owner" || role !== "admin").map(role => <option key={role} value={role}>{TEAM_ROLE_LABELS[role]}</option>)}</select><SubmitButton pendingLabel="...">Salvar</SubmitButton></form><form action={removeTeamMember}><input type="hidden" name="membership_id" value={item.id} /><ConfirmButton className="member-remove" message="Remover esta pessoa da equipe?">Remover</ConfirmButton></form></> : <span className="status-badge">{TEAM_ROLE_LABELS[item.role] ?? item.role}</span>}</div>; })}</div></article>
        {manager && <article className="panel"><div className="panel-heading"><div><h2>Convites pendentes</h2><p>{activeInvitations.length} convite(s) aguardando aceite.</p></div></div>{activeInvitations.length ? <div className="member-list">{activeInvitations.map(invitation => { const link = `${getAppUrl()}/convite/${invitation.token}`; return <div className="member-row" key={invitation.id}><div className="member-identity"><strong>{invitation.email}</strong><small>{TEAM_ROLE_LABELS[invitation.role]} · expira em {new Date(invitation.expires_at).toLocaleDateString("pt-BR")}</small></div><CopyButton value={link} /><form action={cancelTeamInvitation}><input type="hidden" name="invitation_id" value={invitation.id} /><ConfirmButton className="member-remove" message="Cancelar este convite?">Cancelar</ConfirmButton></form></div>; })}</div> : <div className="empty-state compact">Nenhum convite pendente.</div>}</article>}
      </div>
    </div>
  </div>;
}
