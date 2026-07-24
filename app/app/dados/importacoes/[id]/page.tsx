import Link from "next/link";
import { notFound } from "next/navigation";
import { requireWorkspace } from "@/lib/auth/workspace";
import { DATA_ENTITY_LABELS } from "@/lib/domain/data-foundation";
import { SubmitButton } from "../../../_components/submit-button";
import { confirmImport } from "../../actions";

export default async function ImportDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ success?: string }> }) {
  const { id } = await params; const query = await searchParams; const { supabase, tenant } = await requireWorkspace();
  const [{ data: job }, { data: rows }] = await Promise.all([
    supabase.from("data_imports").select("id,entity_type,source_filename,status,total_rows,valid_rows,imported_rows,failed_rows,created_at,completed_at").eq("tenant_id", tenant.id).eq("id", id).maybeSingle(),
    supabase.from("data_import_rows").select("id,row_number,payload,normalized_payload,errors,status").eq("tenant_id", tenant.id).eq("import_id", id).order("row_number").limit(50),
  ]);
  if (!job) notFound();
  return <div className="workspace-content"><Link className="back-link" href="/app/dados">← Voltar para Data Foundation</Link><div className="page-heading"><div><h1>{job.source_filename}</h1><p>{DATA_ENTITY_LABELS[job.entity_type as keyof typeof DATA_ENTITY_LABELS]} · criado em {new Date(job.created_at).toLocaleString("pt-BR")}</p></div><span className="status-badge">{job.status}</span></div>{query.success && <div className="notice">{query.success}</div>}
    <section className="metric-grid import-metrics"><article className="metric-card"><small>Linhas</small><strong>{job.total_rows}</strong><em>arquivo analisado</em></article><article className="metric-card"><small>Válidas</small><strong>{job.valid_rows}</strong><em>prontas para importar</em></article><article className="metric-card"><small>Importadas</small><strong>{job.imported_rows}</strong><em>registros criados</em></article><article className="metric-card"><small>Falhas</small><strong>{job.failed_rows}</strong><em>exigem correção</em></article></section>
    {job.status === "ready" && <section className="panel import-confirm"><div><h2>Confirmar carga</h2><p>A importação cria ou atualiza somente as linhas válidas. Cada resultado permanecerá auditado.</p></div><form action={confirmImport}><input type="hidden" name="import_id" value={job.id} /><SubmitButton pendingLabel="Importando dados...">Importar {job.valid_rows} linha(s)</SubmitButton></form></section>}
    <section className="panel"><div className="panel-heading"><div><h2>Prévia e diagnóstico</h2><p>Primeiras 50 linhas do arquivo.</p></div></div><div className="import-row-list">{rows?.map(row => <article className={row.errors && (row.errors as string[]).length ? "has-error" : ""} key={row.id}><span>#{row.row_number}</span><div><strong>{Object.values(row.normalized_payload as Record<string,string>).filter(Boolean).slice(0,3).join(" · ") || "Linha vazia"}</strong><small>{Object.entries(row.payload as Record<string,string>).slice(0,6).map(([key,value]) => `${key}: ${value}`).join(" | ")}</small>{Boolean((row.errors as string[])?.length) && <em>{(row.errors as string[]).join(" · ")}</em>}</div><b>{row.status}</b></article>)}</div></section>
  </div>;
}
