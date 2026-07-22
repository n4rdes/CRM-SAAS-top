import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createWorkspace } from "./actions";
import "../auth/auth.css";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: membership } = await supabase.from("memberships").select("id").eq("user_id", user.id).limit(1).maybeSingle();
  if (membership) redirect("/app");
  const selectedPlan = String(user.user_metadata.selected_plan ?? "basic").toLowerCase();

  return (
    <main className="auth-page">
      <aside className="auth-aside"><div className="auth-brand"><span className="auth-brand-mark"><i /></span><span>Prismae</span><small>People OS</small></div><div className="auth-aside-copy"><small>Configuração inicial</small><h1>Vamos criar o ambiente da sua empresa.</h1><p>Você será o proprietário e poderá convidar sua equipe depois.</p></div></aside>
      <section className="auth-main"><div className="auth-card"><h2>Primeiro acesso</h2><p>Esses dados identificam sua empresa dentro do Prismae.</p>{params.error && <p className="auth-error">{params.error}</p>}<form className="auth-form" action={createWorkspace}><label>Nome da empresa<input name="company_name" required minLength={2} placeholder="Ex.: Acme Consultoria de RH" /></label><label>Plano inicial<select name="plan" defaultValue={selectedPlan}><option value="basic">Basic</option><option value="pro">Pro</option><option value="custom">Custom</option></select></label><button className="auth-submit">Criar ambiente</button></form></div></section>
    </main>
  );
}
