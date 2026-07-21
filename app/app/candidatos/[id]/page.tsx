import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmButton } from "../../_components/confirm-button";
import { SubmitButton } from "../../_components/submit-button";
import { createApplication, deleteCandidate, updateCandidate } from "../../actions";
import { requireWorkspace } from "@/lib/auth/workspace";
import { APPLICATION_STAGE_LABELS, JOB_STATUS_LABELS } from "@/lib/domain/hr";

const SOURCE_LABELS: Record<string, string> = { manual: "Cadastro manual", linkedin: "LinkedIn", indicacao: "Indicação", site: "Site de carreiras" };

export default async function CandidateDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; success?: string }> }) {
  const [{ id }, queryParams] = await Promise.all([params, searchParams]);
  const { supabase, tenant } = await requireWorkspace();
  const [{ data: candidate }, { data: applications }, { data: jobs }] = await Promise.all([
    supabase.from("candidates").select("id,full_name,email,phone,source,created_at").eq("id", id).eq("tenant_id", tenant.id).maybeSingle(),
    supabase.from("applications").select("id,stage,created_at,job:jobs(id,title,status)").eq("candidate_id", id).eq("tenant_id", tenant.id).order("created_at", { ascending: false }),
    supabase.from("jobs").select("id,title,status").eq("tenant_id", tenant.id).in("status", ["open", "paused"]).order("title"),
  ]);
  if (!candidate) notFound();

  return <div className="workspace-content">
    <Link className="back-link" href="/app/candidatos">← Voltar para candidatos</Link>
    <div className="page-heading"><div><h1>{candidate.full_name}</h1><p>No banco de talentos desde {new Date(candidate.created_at).toLocaleDateString("pt-BR")}.</p></div><span className="record-count">{applications?.length ?? 0} candidatura(s)</span></div>
    {queryParams.error && <div className="notice error-notice">{queryParams.error}</div>}
    {queryParams.success && <div className="notice">{queryParams.success}</div>}
    <div className="detail-grid">
      <article className="panel"><h2>Perfil do candidato</h2><p>Atualize os dados de contato e origem.</p><form className="record-form" action={updateCandidate}><input type="hidden" name="id" value={candidate.id} /><label>Nome completo<input name="full_name" defaultValue={candidate.full_name} required /></label><label>E-mail<input name="email" type="email" defaultValue={candidate.email} required /></label><label>Telefone<input name="phone" defaultValue={candidate.phone ?? ""} /></label><label>Origem<select name="source" defaultValue={candidate.source}>{Object.entries(SOURCE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><SubmitButton>Salvar alterações</SubmitButton></form><form className="danger-zone" action={deleteCandidate}><input type="hidden" name="id" value={candidate.id} /><div><strong>Excluir candidato</strong><small>As candidaturas também serão removidas.</small></div><ConfirmButton message="Excluir permanentemente este candidato e suas candidaturas?">Excluir</ConfirmButton></form></article>
      <div className="detail-stack"><article className="panel"><h2>Adicionar a uma vaga</h2><p>Crie uma candidatura na primeira etapa do processo.</p>{jobs?.length ? <form className="inline-form" action={createApplication}><input type="hidden" name="candidate_id" value={candidate.id} /><select name="job_id" required><option value="">Selecione uma vaga</option>{jobs.map(job => <option key={job.id} value={job.id}>{job.title} · {JOB_STATUS_LABELS[job.status as keyof typeof JOB_STATUS_LABELS]}</option>)}</select><SubmitButton pendingLabel="Adicionando...">Adicionar</SubmitButton></form> : <div className="empty-state compact">Abra uma vaga antes de adicionar o candidato.</div>}</article><article className="panel"><div className="panel-heading"><div><h2>Histórico de processos</h2><p>Vagas em que o candidato participou.</p></div></div>{applications?.length ? <table className="record-list"><thead><tr><th>Vaga</th><th>Etapa</th><th>Entrada</th><th></th></tr></thead><tbody>{applications.map(application => { const job = application.job as unknown as { id: string; title: string; status: string } | null; return <tr key={application.id}><td><strong>{job?.title ?? "Vaga removida"}</strong></td><td>{APPLICATION_STAGE_LABELS[application.stage as keyof typeof APPLICATION_STAGE_LABELS] ?? application.stage}</td><td>{new Date(application.created_at).toLocaleDateString("pt-BR")}</td><td>{job && <Link className="row-link" href={`/app/vagas/${job.id}`}>Pipeline →</Link>}</td></tr>; })}</tbody></table> : <div className="empty-state">Nenhuma candidatura registrada.</div>}</article></div>
    </div>
  </div>;
}
