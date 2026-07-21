import Link from "next/link";
import { notFound } from "next/navigation";
import { acceptInvitation } from "./actions";
import { createClient } from "@/lib/supabase/server";
import { TEAM_ROLE_LABELS } from "@/lib/domain/team";

type InvitationPreview = { tenant_name: string; invited_email: string; invited_role: string; invitation_status: string; invitation_expires_at: string };

export default async function InvitationPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string }> }) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(token)) notFound();
  const supabase = await createClient();
  const [{ data }, { data: authData }] = await Promise.all([
    supabase.rpc("preview_tenant_invitation", { p_token: token }),
    supabase.auth.getUser(),
  ]);
  const invitation = (data?.[0] ?? null) as InvitationPreview | null;
  if (!invitation) notFound();
  const next = `/convite/${token}`;
  const available = invitation.invitation_status === "pending";

  return <div className="auth-card">
    <h2>Convite para {invitation.tenant_name}</h2>
    <p>Você recebeu acesso como <strong>{TEAM_ROLE_LABELS[invitation.invited_role] ?? invitation.invited_role}</strong>, usando o e-mail <strong>{invitation.invited_email}</strong>.</p>
    {query.error && <p className="auth-error">{query.error}</p>}
    {!available ? <p className="auth-error">Este convite está {invitation.invitation_status === "expired" ? "expirado" : "indisponível"}. Solicite um novo link à empresa.</p> : authData.user ? <form className="auth-form" action={acceptInvitation}><input type="hidden" name="token" value={token} /><button className="auth-submit" type="submit">Aceitar e entrar no ambiente</button></form> : <div className="invite-actions"><Link className="auth-submit invite-action" href={`/auth/signup?next=${encodeURIComponent(next)}&email=${encodeURIComponent(invitation.invited_email)}`}>Criar conta e aceitar</Link><Link href={`/auth/login?next=${encodeURIComponent(next)}`}>Já tenho conta — entrar</Link></div>}
    <p className="invite-expiry">O convite expira em {new Date(invitation.invitation_expires_at).toLocaleDateString("pt-BR")}.</p>
  </div>;
}
