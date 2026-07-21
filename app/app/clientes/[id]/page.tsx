import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmButton } from "../../_components/confirm-button";
import { SubmitButton } from "../../_components/submit-button";
import { deleteCompany, updateCompany } from "../../actions";
import { requireWorkspace } from "@/lib/auth/workspace";
import { COMPANY_STAGES, COMPANY_STAGE_LABELS, JOB_STATUS_LABELS } from "@/lib/domain/hr";

export default async function ClientDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; success?: string }> }) {
  const [{ id }, queryParams] = await Promise.all([params, searchParams]);
  const { supabase, tenant } = await requireWorkspace();
  const [{ data: client }, { data: jobs }] = await Promise.all([
    supabase.from("crm_companies").select("id,name,email,phone,stage,created_at").eq("id", id).eq("tenant_id", tenant.id).maybeSingle(),
    supabase.from("jobs").select("id,title,status,openings,created_at").eq("company_id", id).eq("tenant_id", tenant.id).order("created_at", { ascending: false }),
  ]);
  if (!client) notFound();

  return <div className="workspace-content">
    <Link className="back-link" href="/app/clientes">← Voltar para clientes</Link>
    <div className="page-heading"><div><h1>{client.name}</h1><p>Cliente desde {new Date(client.created_at).toLocaleDateString("pt-BR")}.</p></div><span className={`status-badge status-${client.stage}`}>{COMPANY_STAGE_LABELS[client.stage as keyof typeof COMPANY_STAGE_LABELS] ?? client.stage}</span></div>
    {queryParams.error && <div className="notice error-notice">{queryParams.error}</div>}
    {queryParams.success && <div className="notice">{queryParams.success}</div>}
    <div className="detail-grid">
      <article className="panel"><h2>Dados comerciais</h2><p>Atualize contato e etapa do funil.</p><form className="record-form" action={updateCompany}><input type="hidden" name="id" value={client.id} /><label>Nome da empresa<input name="name" defaultValue={client.name} required /></label><label>E-mail<input name="email" type="email" defaultValue={client.email ?? ""} /></label><label>Telefone<input name="phone" defaultValue={client.phone ?? ""} /></label><label>Etapa<select name="stage" defaultValue={client.stage}>{COMPANY_STAGES.map(stage => <option key={stage} value={stage}>{COMPANY_STAGE_LABELS[stage]}</option>)}</select></label><SubmitButton>Salvar alterações</SubmitButton></form><form className="danger-zone" action={deleteCompany}><input type="hidden" name="id" value={client.id} /><div><strong>Excluir cliente</strong><small>As vagas serão mantidas como vagas internas.</small></div><ConfirmButton message="Tem certeza que deseja excluir este cliente?">Excluir</ConfirmButton></form></article>
      <article className="panel"><div className="panel-heading"><div><h2>Vagas vinculadas</h2><p>{jobs?.length ?? 0} processo(s) deste cliente.</p></div><Link className="secondary-action" href="/app/vagas">Nova vaga</Link></div>{jobs?.length ? <table className="record-list"><thead><tr><th>Vaga</th><th>Posições</th><th>Status</th><th></th></tr></thead><tbody>{jobs.map(job => <tr key={job.id}><td><strong>{job.title}</strong><small>{new Date(job.created_at).toLocaleDateString("pt-BR")}</small></td><td>{job.openings}</td><td>{JOB_STATUS_LABELS[job.status as keyof typeof JOB_STATUS_LABELS] ?? job.status}</td><td><Link className="row-link" href={`/app/vagas/${job.id}`}>Abrir →</Link></td></tr>)}</tbody></table> : <div className="empty-state">Nenhuma vaga vinculada a este cliente.</div>}</article>
    </div>
  </div>;
}
