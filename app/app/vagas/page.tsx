import Link from "next/link";
import { createJob } from "../actions";
import { SubmitButton } from "../_components/submit-button";
import { requireWorkspace } from "@/lib/auth/workspace";
import { JOB_STATUSES, JOB_STATUS_LABELS, isJobStatus } from "@/lib/domain/hr";

export default async function JobsPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string; q?: string; status?: string }> }) {
  const params = await searchParams;
  const { supabase, tenant } = await requireWorkspace();
  const q = (params.q ?? "").trim().slice(0, 80);
  const status = isJobStatus(params.status ?? "") ? params.status! : "";
  let jobsQuery = supabase.from("jobs").select("id,title,status,openings,created_at,company:crm_companies(name),applications(count)").eq("tenant_id", tenant.id).order("created_at", { ascending: false }).limit(100);
  if (q) jobsQuery = jobsQuery.ilike("title", `%${q}%`);
  if (status) jobsQuery = jobsQuery.eq("status", status);
  const [{ data: jobs }, { data: companies }] = await Promise.all([jobsQuery, supabase.from("crm_companies").select("id,name").eq("tenant_id", tenant.id).order("name")]);

  return <div className="workspace-content">
    <div className="page-heading"><div><h1>Vagas</h1><p>Requisições, processos seletivos e pipeline ATS.</p></div><span className="record-count">{jobs?.length ?? 0} registros</span></div>
    {params.error && <div className="notice error-notice">{params.error}</div>}
    {params.success && <div className="notice">{params.success}</div>}
    <form className="list-filters" method="get"><input name="q" defaultValue={q} placeholder="Buscar vaga pelo título" /><select name="status" defaultValue={status}><option value="">Todos os status</option>{JOB_STATUSES.map(item => <option key={item} value={item}>{JOB_STATUS_LABELS[item]}</option>)}</select><button>Filtrar</button>{(q || status) && <Link href="/app/vagas">Limpar</Link>}</form>
    <div className="data-layout">
      <article className="panel sticky-panel"><h2>Abrir vaga</h2><p>Associe a vaga a um cliente quando necessário.</p><form className="record-form" action={createJob}><label>Título da vaga<input name="title" required /></label><label>Cliente<select name="company_id"><option value="">Vaga interna / sem cliente</option>{companies?.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label><label>Número de posições<input name="openings" type="number" min="1" defaultValue="1" /></label><label>Descrição<textarea name="description" rows={4} placeholder="Responsabilidades, requisitos e observações" /></label><SubmitButton>Abrir vaga</SubmitButton></form></article>
      <article className="panel"><div className="panel-heading"><div><h2>Processos seletivos</h2><p>Abra uma vaga para movimentar candidatos no pipeline.</p></div></div>{jobs?.length ? <table className="record-list"><thead><tr><th>Vaga</th><th>Cliente</th><th>Candidatos</th><th>Status</th><th></th></tr></thead><tbody>{jobs.map(job => <tr key={job.id}><td><strong>{job.title}</strong><small>{job.openings} posição(ões)</small></td><td>{(job.company as unknown as { name?: string } | null)?.name ?? "Interna"}</td><td>{(job.applications as unknown as Array<{ count: number }> | null)?.[0]?.count ?? 0}</td><td><span className={`status-badge status-${job.status}`}>{JOB_STATUS_LABELS[job.status as keyof typeof JOB_STATUS_LABELS] ?? job.status}</span></td><td><Link className="row-link" href={`/app/vagas/${job.id}`}>Pipeline →</Link></td></tr>)}</tbody></table> : <div className="empty-state">Nenhuma vaga encontrada.</div>}</article>
    </div>
  </div>;
}
