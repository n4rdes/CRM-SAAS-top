import { updatePassword } from "../actions";

export default async function UpdatePasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return <div className="auth-card"><h2>Nova senha</h2><p>Escolha uma senha com pelo menos 8 caracteres.</p>{params.error && <p className="auth-error">{params.error}</p>}<form className="auth-form" action={updatePassword}><label>Nova senha<input name="password" type="password" minLength={8} required /></label><button className="auth-submit">Salvar nova senha</button></form></div>;
}
