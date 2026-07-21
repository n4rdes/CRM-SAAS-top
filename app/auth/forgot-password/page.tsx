import Link from "next/link";
import { requestPasswordReset } from "../actions";

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return <div className="auth-card"><h2>Recuperar senha</h2><p>Enviaremos um link seguro para seu e-mail.</p>{params.error && <p className="auth-error">{params.error}</p>}<form className="auth-form" action={requestPasswordReset}><label>E-mail<input name="email" type="email" required /></label><button className="auth-submit">Enviar link</button></form><div className="auth-links"><Link href="/auth/login">← Voltar ao login</Link></div></div>;
}
