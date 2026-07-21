import Link from "next/link";
import "../auth/auth.css";

export default function InviteLayout({ children }: { children: React.ReactNode }) {
  return <main className="auth-page">
    <Link className="auth-back" href="/">← Voltar ao site</Link>
    <aside className="auth-aside"><Link className="auth-brand" href="/">prismae</Link><div className="auth-aside-copy"><small>Convite de equipe</small><h1>Trabalho de RH conectado de verdade.</h1><p>Entre no ambiente da sua empresa e colabore em clientes, vagas e candidatos com acesso controlado.</p></div></aside>
    <section className="auth-main">{children}</section>
  </main>;
}
