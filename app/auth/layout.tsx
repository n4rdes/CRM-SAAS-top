import Link from "next/link";
import "./auth.css";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-page">
      <Link className="auth-back" href="/">← Voltar ao site</Link>
      <aside className="auth-aside">
        <Link className="auth-brand" href="/"><span className="auth-brand-mark"><i /></span><span>Prismae</span><small>People OS</small></Link>
        <div className="auth-aside-copy">
          <small>People OS</small>
          <h1>Uma operação de pessoas realmente conectada.</h1>
          <p>CRM, recrutamento, candidatos e colaboradores em uma base segura, multiempresa e pronta para crescer.</p>
        </div>
      </aside>
      <section className="auth-main">{children}</section>
    </main>
  );
}
