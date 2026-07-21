import Link from "next/link";

export default async function CheckEmailPage({ searchParams }: { searchParams: Promise<{ email?: string; recovery?: string }> }) {
  const params = await searchParams;
  return <div className="auth-card"><h2>Confira seu e-mail</h2><p className="auth-success">Enviamos {params.recovery ? "o link de recuperação" : "o link de confirmação"} para <strong>{params.email ?? "seu endereço"}</strong>.</p><p>Abra a mensagem e clique no link para continuar. Verifique também a caixa de spam.</p><div className="auth-links"><Link href="/auth/login">Voltar ao login</Link></div></div>;
}
