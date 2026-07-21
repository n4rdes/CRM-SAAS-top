import Link from "next/link";
import { signIn } from "../actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="auth-card">
      <h2>Entrar no Prismae</h2>
      <p>Acesse o ambiente real da sua empresa.</p>
      {params.error && <p className="auth-error">{params.error}</p>}
      <form className="auth-form" action={signIn}>
        <input type="hidden" name="next" value={params.next ?? "/app"} />
        <label>E-mail<input name="email" type="email" autoComplete="email" required /></label>
        <label>Senha<input name="password" type="password" autoComplete="current-password" required /></label>
        <button className="auth-submit" type="submit">Entrar</button>
      </form>
      <div className="auth-links">
        <Link href="/auth/forgot-password">Esqueci minha senha</Link>
        <Link href={`/auth/signup?next=${encodeURIComponent(params.next ?? "/app")}`}>Criar conta</Link>
      </div>
    </div>
  );
}
