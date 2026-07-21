import Link from "next/link";
import { signUp } from "../actions";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; plan?: string }>;
}) {
  const params = await searchParams;
  const plan = ["basic", "pro", "custom"].includes(params.plan ?? "") ? params.plan : "basic";
  return (
    <div className="auth-card">
      <h2>Crie sua conta</h2>
      <p>Comece a configurar o ambiente da sua empresa. A cobrança será ativada em uma etapa posterior.</p>
      {params.error && <p className="auth-error">{params.error}</p>}
      <form className="auth-form" action={signUp}>
        <label>Nome completo<input name="full_name" autoComplete="name" required minLength={3} /></label>
        <label>E-mail profissional<input name="email" type="email" autoComplete="email" required /></label>
        <label>Senha<input name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
        <label>Plano de interesse
          <select name="plan" defaultValue={plan}>
            <option value="basic">Basic</option><option value="pro">Pro</option><option value="custom">Custom</option>
          </select>
        </label>
        <button className="auth-submit" type="submit">Criar conta segura</button>
      </form>
      <div className="auth-links"><span>Já tem uma conta?</span><Link href="/auth/login">Entrar</Link></div>
    </div>
  );
}
