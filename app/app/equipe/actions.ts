"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/auth/workspace";
import { canManageTeam, isTeamRole } from "@/lib/domain/team";

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function isUuid(input: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input);
}

function fail(message: string): never {
  redirect(`/app/equipe?error=${encodeURIComponent(message)}`);
}

function success(message: string, token?: string): never {
  const params = new URLSearchParams({ success: message });
  if (token) params.set("token", token);
  redirect(`/app/equipe?${params.toString()}`);
}

function mapRpcError(message: string) {
  const messages: Array<[string, string]> = [
    ["USER_LIMIT_REACHED", "O limite de usuários do plano foi atingido. Faça upgrade para convidar mais pessoas."],
    ["ALREADY_A_MEMBER", "Esse e-mail já pertence à equipe."],
    ["INVALID_EMAIL", "Informe um e-mail válido."],
    ["OWNER_REQUIRED_FOR_ADMIN", "Somente o proprietário pode conceder ou alterar o acesso de administrador."],
    ["ADMIN_REQUIRED", "Você não tem permissão para gerenciar a equipe."],
    ["CANNOT_REMOVE_OWNER_OR_SELF", "O proprietário e sua própria conta não podem ser removidos."],
  ];
  return messages.find(([code]) => message.includes(code))?.[1] ?? "Não foi possível concluir a alteração da equipe.";
}

async function requireTeamManager() {
  const context = await requireWorkspace();
  if (!canManageTeam(context.membership.role)) fail("Somente proprietários e administradores podem gerenciar a equipe.");
  return context;
}

export async function createTeamInvitation(formData: FormData) {
  const email = value(formData, "email").toLowerCase();
  const role = value(formData, "role");
  if (!email || !isTeamRole(role)) fail("Revise o e-mail e a função do convite.");
  const { supabase, tenant } = await requireTeamManager();
  const { data, error } = await supabase.rpc("create_tenant_invitation", { p_tenant_id: tenant.id, p_email: email, p_role: role });
  if (error || !data) fail(mapRpcError(error?.message ?? ""));
  revalidatePath("/app/equipe");
  success("Convite criado. Copie o link e envie para a pessoa.", String(data));
}

export async function updateMemberRole(formData: FormData) {
  const membershipId = value(formData, "membership_id");
  const role = value(formData, "role");
  if (!isUuid(membershipId) || !isTeamRole(role)) fail("Membro ou função inválidos.");
  const { supabase } = await requireTeamManager();
  const { error } = await supabase.rpc("update_tenant_member_role", { p_membership_id: membershipId, p_role: role });
  if (error) fail(mapRpcError(error.message));
  revalidatePath("/app", "layout");
  success("Permissão atualizada.");
}

export async function removeTeamMember(formData: FormData) {
  const membershipId = value(formData, "membership_id");
  if (!isUuid(membershipId)) fail("Membro inválido.");
  const { supabase } = await requireTeamManager();
  const { error } = await supabase.rpc("remove_tenant_member", { p_membership_id: membershipId });
  if (error) fail(mapRpcError(error.message));
  revalidatePath("/app", "layout");
  success("Membro removido da equipe.");
}

export async function cancelTeamInvitation(formData: FormData) {
  const invitationId = value(formData, "invitation_id");
  if (!isUuid(invitationId)) fail("Convite inválido.");
  const { supabase } = await requireTeamManager();
  const { error } = await supabase.rpc("cancel_tenant_invitation", { p_invitation_id: invitationId });
  if (error) fail(mapRpcError(error.message));
  revalidatePath("/app/equipe");
  success("Convite cancelado.");
}
