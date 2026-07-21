"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function acceptInvitation(formData: FormData) {
  const token = String(formData.get("token") ?? "").trim();
  const path = `/convite/${token}`;
  if (!/^[0-9a-f-]{36}$/i.test(token)) redirect(`${path}?error=${encodeURIComponent("Convite inválido.")}`);
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_tenant_invitation", { p_token: token });
  if (error) {
    const messages: Array<[string, string]> = [
      ["INVITATION_EXPIRED", "Este convite expirou. Peça um novo convite ao administrador."],
      ["INVITATION_EMAIL_MISMATCH", "Entre com o mesmo e-mail para o qual o convite foi criado."],
      ["USER_ALREADY_HAS_WORKSPACE", "Esta conta já pertence a outro ambiente do Prismae."],
      ["INVITATION_NOT_PENDING", "Este convite já foi utilizado ou cancelado."],
    ];
    const message = messages.find(([code]) => error.message.includes(code))?.[1] ?? "Não foi possível aceitar o convite.";
    redirect(`${path}?error=${encodeURIComponent(message)}`);
  }
  redirect("/app?success=Convite aceito. Bem-vindo à equipe!");
}
