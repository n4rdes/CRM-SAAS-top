import Link from "next/link";
import { signUp } from "../actions";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; plan?: string; next?: string; email?: string; utm_source?: string; utm_medium?: string; utm_campaign?: string; utm_content?: string; utm_term?: string; gclid?: string }>;
}) {
  const params = await searchParams;
  const plan = ["basic", "pro", "custom"].includes(params.plan ?? "") ? params.plan : "basic";
  return (
    <div className="auth-card">
      <h2>Crie sua conta</h2>
      <p>Configure o ambiente da sua empresa e teste por 14 dias. Você escolhe a assinatura antes do fim da avaliação.</p>
      {params.error && <p className="auth-error">{params.error}</p>}
      <form className="auth-form" action={signUp}>
        <input type="hidden" name="next" value={params.next ?? "/onboarding"} />
        {(["utm_source","utm_medium","utm_campaign","utm_content","utm_term","gclid"] as const).map(key => params[key] ? <input type="hidden" name={key} value={params[key]} key={key} /> : null)}
        <label>Nome completo<input name="full_name" autoComplete="name" required minLength={3} /></label>
        <label>E-mail profissional<input name="email" type="email" autoComplete="email" defaultValue={params.email ?? ""} required /></label>
        <label>Senha<input name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
        <label>Plano de interesse
          <select name="plan" defaultValue={plan}>
            <option value="basic">Basic</option><option value="pro">Pro</option><option value="custom">Custom</option>
          </select>
        </label>
        <button className="auth-submit" type="submit">Criar conta segura</button>
      </form>
      <div className="auth-links"><span>Já tem uma conta?</span><Link href={`/auth/login?next=${encodeURIComponent(params.next ?? "/app")}`}>Entrar</Link></div>
    </div>
  );
}
