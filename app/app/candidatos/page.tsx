import Link from "next/link";
import { createCandidate } from "../actions";
import { SubmitButton } from "../_components/submit-button";
import { requireWorkspace } from "@/lib/auth/workspace";

const SOURCES = ["manual", "linkedin", "indicacao", "site"] as const;
const SOURCE_LABELS: Record<string, string> = { manual: "Cadastro manual", linkedin: "LinkedIn", indicacao: "Indicação", site: "Site de carreiras" };

export default async function CandidatesPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string; q?: string; source?: string }> }) {
  const params = await searchParams;
  const { supabase, tenant } = await requireWorkspace();
  const q = (params.q ?? "").trim().slice(0, 80);
  const source = SOURCES.includes(params.source as (typeof SOURCES)[number]) ? params.source! : "";
  let query = supabase.from("candidates").select("id,full_name,email,phone,source,created_at").eq("tenant_id", tenant.id).order("created_at", { ascending: false }).limit(100);
  if (q) query = query.ilike("full_name", `%${q}%`);
  if (source) query = query.eq("source", source);
  const { data } = await query;

  return <div className="workspace-content">
    <div className="page-heading"><div><h1>Candidatos</h1><p>Banco de talentos conectado aos processos seletivos.</p></div><span className="record-count">{data?.length ?? 0} registros</span></div>
    {params.error && <div className="notice error-notice">{params.error}</div>}
    {params.success && <div className="notice">{params.success}</div>}
    <form className="list-filters" method="get"><input name="q" defaultValue={q} placeholder="Buscar candidato pelo nome" /><select name="source" defaultValue={source}><option value="">Todas as origens</option>{SOURCES.map(item => <option key={item} value={item}>{SOURCE_LABELS[item]}</option>)}</select><button>Filtrar</button>{(q || source) && <Link href="/app/candidatos">Limpar</Link>}</form>
    <div className="data-layout">
      <article className="panel sticky-panel"><h2>Novo candidato</h2><p>O registro ficará disponível apenas neste ambiente.</p><form className="record-form" action={createCandidate}><label>Nome completo<input name="full_name" required /></label><label>E-mail<input name="email" type="email" required /></label><label>Telefone<input name="phone" /></label><label>Origem<select name="source">{SOURCES.map(item => <option key={item} value={item}>{SOURCE_LABELS[item]}</option>)}</select></label><SubmitButton>Salvar candidato</SubmitButton></form></article>
      <article className="panel"><div className="panel-heading"><div><h2>Banco de talentos</h2><p>Abra o perfil para editar ou ver candidaturas.</p></div></div>{data?.length ? <table className="record-list"><thead><tr><th>Candidato</th><th>Contato</th><th>Origem</th><th></th></tr></thead><tbody>{data.map(item => <tr key={item.id}><td><strong>{item.full_name}</strong><small>{new Date(item.created_at).toLocaleDateString("pt-BR")}</small></td><td>{item.email}</td><td>{SOURCE_LABELS[item.source] ?? item.source}</td><td><Link className="row-link" href={`/app/candidatos/${item.id}`}>Abrir →</Link></td></tr>)}</tbody></table> : <div className="empty-state">Nenhum candidato encontrado.</div>}</article>
    </div>
  </div>;
}
