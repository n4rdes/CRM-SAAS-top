import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmButton } from "../../_components/confirm-button";
import { SubmitButton } from "../../_components/submit-button";
import { createApplication, deleteApplication, deleteJob, updateApplicationStage, updateJob } from "../../actions";
import { requireWorkspace } from "@/lib/auth/workspace";
import { APPLICATION_STAGES, APPLICATION_STAGE_LABELS, JOB_STATUSES, JOB_STATUS_LABELS } from "@/lib/domain/hr";

type Application = { id: string; stage: string; created_at: string; candidate: { id: string; full_name: string; email: string; source: string } | null };

export default async function JobDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; success?: string }> }) {
  const [{ id }, queryParams] = await Promise.all([params, searchParams]);
  const { supabase, tenant } = await requireWorkspace();
  const [{ data: job }, { data: applicationsData }, { data: candidates }, { data: companies }] = await Promise.all([
    supabase.from("jobs").select("id,title,description,status,openings,company_id,created_at,company:crm_companies(id,name)").eq("id", id).eq("tenant_id", tenant.id).maybeSingle(),
    supabase.from("applications").select("id,stage,created_at,candidate:candidates(id,full_name,email,source)").eq("job_id", id).eq("tenant_id", tenant.id).order("created_at", { ascending: true }),
    supabase.from("candidates").select("id,full_name,email").eq("tenant_id", tenant.id).order("full_name").limit(500),
    supabase.from("crm_companies").select("id,name").eq("tenant_id", tenant.id).order("name"),
  ]);
  if (!job) notFound();
  const applications = (applicationsData ?? []) as unknown as Application[];
  const company = job.company as unknown as { id: string; name: string } | null;

  return <div className="workspace-content wide-content">
    <Link className="back-link" href="/app/vagas">← Voltar para vagas</Link>
    <div className="page-heading"><div><h1>{job.title}</h1><p>{company?.name ?? "Vaga interna"} · {job.openings} posição(ões) · criada em {new Date(job.created_at).toLocaleDateString("pt-BR")}</p></div><span className={`status-badge status-${job.status}`}>{JOB_STATUS_LABELS[job.status as keyof typeof JOB_STATUS_LABELS] ?? job.status}</span></div>
    {queryParams.error && <div className="notice error-notice">{queryParams.error}</div>}
    {queryParams.success && <div className="notice">{queryParams.success}</div>}
    <section className="job-management">
      <article className="panel"><h2>Configurações da vaga</h2><form className="record-form compact-form" action={updateJob}><input type="hidden" name="id" value={job.id} /><label>Título<input name="title" defaultValue={job.title} required /></label><label>Cliente<select name="company_id" defaultValue={job.company_id ?? ""}><option value="">Vaga interna / sem cliente</option>{companies?.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Posições<input name="openings" type="number" min="1" defaultValue={job.openings} /></label><label>Status<select name="status" defaultValue={job.status}>{JOB_STATUSES.map(status => <option key={status} value={status}>{JOB_STATUS_LABELS[status]}</option>)}</select></label><label className="full-field">Descrição<textarea name="description" rows={3} defaultValue={job.description ?? ""} /></label><SubmitButton className="full-field">Salvar vaga</SubmitButton></form></article>
      <article className="panel"><h2>Adicionar candidato</h2><p>O candidato entrará na etapa “Inscrito”.</p>{candidates?.length ? <form className="inline-form vertical" action={createApplication}><input type="hidden" name="job_id" value={job.id} /><select name="candidate_id" required><option value="">Selecione no banco de talentos</option>{candidates.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.full_name} · {candidate.email}</option>)}</select><SubmitButton pendingLabel="Adicionando...">Adicionar ao pipeline</SubmitButton></form> : <div className="empty-state compact"><Link href="/app/candidatos">Cadastre um candidato primeiro.</Link></div>}<form className="danger-zone" action={deleteJob}><input type="hidden" name="id" value={job.id} /><div><strong>Excluir vaga</strong><small>Também remove as candidaturas desta vaga.</small></div><ConfirmButton message="Excluir permanentemente esta vaga e suas candidaturas?">Excluir</ConfirmButton></form></article>
    </section>
    <section className="pipeline-section"><div className="panel-heading pipeline-heading"><div><h2>Pipeline de recrutamento</h2><p>{applications.length} candidato(s) distribuídos por etapa.</p></div></div><div className="real-pipeline">{APPLICATION_STAGES.map(stage => { const stageApplications = applications.filter(application => application.stage === stage); return <article className="pipeline-column" key={stage}><header><strong>{APPLICATION_STAGE_LABELS[stage]}</strong><span>{stageApplications.length}</span></header><div>{stageApplications.map(application => <div className="application-card" key={application.id}><Link href={`/app/candidatos/${application.candidate?.id}`}><strong>{application.candidate?.full_name ?? "Candidato removido"}</strong><small>{application.candidate?.email ?? "—"}</small></Link><form action={updateApplicationStage}><input type="hidden" name="application_id" value={application.id} /><input type="hidden" name="job_id" value={job.id} /><select name="stage" defaultValue={application.stage}>{APPLICATION_STAGES.map(option => <option key={option} value={option}>{APPLICATION_STAGE_LABELS[option]}</option>)}</select><SubmitButton className="move-button" pendingLabel="...">Mover</SubmitButton></form><form action={deleteApplication}><input type="hidden" name="application_id" value={application.id} /><input type="hidden" name="job_id" value={job.id} /><ConfirmButton className="remove-application" message="Remover este candidato da vaga?">Remover da vaga</ConfirmButton></form></div>)}{!stageApplications.length && <div className="pipeline-empty">Nenhum candidato</div>}</div></article>; })}</div></section>
  </div>;
}
