import Link from "next/link";
import { createCompany } from "../actions";
import { SubmitButton } from "../_components/submit-button";
import { requireWorkspace } from "@/lib/auth/workspace";
import { COMPANY_STAGES, COMPANY_STAGE_LABELS, isCompanyStage } from "@/lib/domain/hr";

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string; q?: string; stage?: string }> }) {
  const params = await searchParams;
  const { supabase, tenant } = await requireWorkspace();
  const q = (params.q ?? "").trim().slice(0, 80);
  const stage = isCompanyStage(params.stage ?? "") ? params.stage! : "";
  let query = supabase.from("crm_companies").select("id,name,email,phone,stage,created_at").eq("tenant_id", tenant.id).order("created_at", { ascending: false }).limit(100);
  if (q) query = query.ilike("name", `%${q}%`);
  if (stage) query = query.eq("stage", stage);
  const { data } = await query;

  return <div className="workspace-content">
    <div className="page-heading"><div><h1>Clientes</h1><p>Prospecção, negociação e carteira comercial.</p></div><span className="record-count">{data?.length ?? 0} registros</span></div>
    {params.error && <div className="notice error-notice">{params.error}</div>}
    {params.success && <div className="notice">{params.success}</div>}
    <form className="list-filters" method="get"><input name="q" defaultValue={q} placeholder="Buscar cliente pelo nome" /><select name="stage" defaultValue={stage}><option value="">Todas as etapas</option>{COMPANY_STAGES.map(item => <option key={item} value={item}>{COMPANY_STAGE_LABELS[item]}</option>)}</select><button>Filtrar</button>{(q || stage) && <Link href="/app/clientes">Limpar</Link>}</form>
    <div className="data-layout">
      <article className="panel sticky-panel"><h2>Novo cliente</h2><p>Cadastre uma empresa ou oportunidade comercial.</p><form className="record-form" action={createCompany}><label>Nome da empresa<input name="name" required /></label><label>E-mail<input name="email" type="email" /></label><label>Telefone<input name="phone" /></label><SubmitButton>Salvar cliente</SubmitButton></form></article>
      <article className="panel"><div className="panel-heading"><div><h2>Base de clientes</h2><p>Clique em um registro para editar e acompanhar as vagas.</p></div></div>{data?.length ? <table className="record-list"><thead><tr><th>Empresa</th><th>Contato</th><th>Etapa</th><th></th></tr></thead><tbody>{data.map(item => <tr key={item.id}><td><strong>{item.name}</strong><small>{new Date(item.created_at).toLocaleDateString("pt-BR")}</small></td><td>{item.email || item.phone || "—"}</td><td><span className={`status-badge status-${item.stage}`}>{COMPANY_STAGE_LABELS[item.stage as keyof typeof COMPANY_STAGE_LABELS] ?? item.stage}</span></td><td><Link className="row-link" href={`/app/clientes/${item.id}`}>Abrir →</Link></td></tr>)}</tbody></table> : <div className="empty-state">Nenhum cliente encontrado.</div>}</article>
    </div>
  </div>;
}
