import { NextRequest } from "next/server";
import { requireWorkspace } from "@/lib/auth/workspace";
import { APPLICATION_STAGE_LABELS, COMPANY_STAGE_LABELS } from "@/lib/domain/hr";
import { GOAL_STATUS_LABELS } from "@/lib/domain/performance";
import { normalizeReportPeriod, REPORT_CARD_IDS, rowsToCsv, sanitizeReportCards } from "@/lib/domain/reporting";

function section(rows: unknown[][], title: string, headers: string[], data: unknown[][]) {
  rows.push([title], headers, ...data, []);
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const period = normalizeReportPeriod(searchParams.get("from") ?? undefined, searchParams.get("to") ?? undefined);
  const requestedCards = sanitizeReportCards((searchParams.get("cards") ?? REPORT_CARD_IDS.join(",")).split(","));
  const start = `${period.from}T00:00:00.000Z`;
  const end = `${period.to}T23:59:59.999Z`;
  const { supabase, tenant } = await requireWorkspace();

  const [companies, jobs, candidates, applications, employees, goals, reviews, checkins, surveys, leaves] = await Promise.all([
    supabase.from("crm_companies").select("name,stage,created_at").eq("tenant_id", tenant.id).gte("created_at", start).lte("created_at", end).order("created_at"),
    supabase.from("jobs").select("title,status,openings,created_at").eq("tenant_id", tenant.id).gte("created_at", start).lte("created_at", end).order("created_at"),
    supabase.from("candidates").select("full_name,source,created_at").eq("tenant_id", tenant.id).gte("created_at", start).lte("created_at", end).order("created_at"),
    supabase.from("applications").select("stage,created_at,candidate:candidates(full_name),job:jobs(title)").eq("tenant_id", tenant.id).gte("created_at", start).lte("created_at", end).order("created_at"),
    supabase.from("employees").select("full_name,status,hire_date,termination_date,department:departments(name),position:positions(title)").eq("tenant_id", tenant.id).order("full_name"),
    supabase.from("performance_goals").select("title,status,progress,weight,due_on,employee:employees(full_name)").eq("tenant_id", tenant.id).gte("created_at", start).lte("created_at", end).order("created_at"),
    supabase.from("performance_reviews").select("status,overall_rating,created_at,employee:employees(full_name)").eq("tenant_id", tenant.id).gte("created_at", start).lte("created_at", end).order("created_at"),
    supabase.from("performance_checkins").select("mood,energy,happened_on,employee:employees(full_name)").eq("tenant_id", tenant.id).gte("happened_on", period.from).lte("happened_on", period.to).order("happened_on"),
    supabase.from("engagement_surveys").select("title,kind,status,starts_on,ends_on,created_at").eq("tenant_id", tenant.id).gte("created_at", start).lte("created_at", end).order("created_at"),
    supabase.from("leave_requests").select("status,start_date,end_date,total_days,employee:employees(full_name),policy:leave_policies(name)").eq("tenant_id", tenant.id).lte("start_date", period.to).gte("end_date", period.from).order("start_date"),
  ]);

  const rows: unknown[][] = [
    ["PRISMAE PEOPLE OS — RELATÓRIO EXPORTADO"],
    ["Empresa", tenant.name],
    ["Período", period.from, period.to],
    ["Gerado em", new Date().toLocaleString("pt-BR")],
    [],
  ];

  if (requestedCards.includes("commercial")) {
    section(rows, "CRM COMERCIAL", ["Empresa", "Etapa", "Criada em"], (companies.data ?? []).map(item => [item.name, COMPANY_STAGE_LABELS[item.stage as keyof typeof COMPANY_STAGE_LABELS] ?? item.stage, item.created_at]));
  }
  if (requestedCards.includes("recruitment")) {
    section(rows, "VAGAS", ["Vaga", "Status", "Posições", "Criada em"], (jobs.data ?? []).map(item => [item.title, item.status, item.openings, item.created_at]));
    section(rows, "CANDIDATURAS", ["Candidato", "Vaga", "Etapa", "Criada em"], (applications.data ?? []).map(item => { const candidate = item.candidate as unknown as { full_name?: string } | null; const job = item.job as unknown as { title?: string } | null; return [candidate?.full_name, job?.title, APPLICATION_STAGE_LABELS[item.stage as keyof typeof APPLICATION_STAGE_LABELS] ?? item.stage, item.created_at]; }));
  }
  if (requestedCards.includes("sources")) {
    section(rows, "ORIGEM DOS CANDIDATOS", ["Candidato", "Origem", "Criado em"], (candidates.data ?? []).map(item => [item.full_name, item.source ?? "Manual", item.created_at]));
  }
  if (requestedCards.includes("headcount")) {
    section(rows, "HEADCOUNT", ["Colaborador", "Status", "Departamento", "Cargo", "Admissão", "Desligamento"], (employees.data ?? []).filter(item => (!item.hire_date || item.hire_date <= period.to) && (!item.termination_date || item.termination_date >= period.from)).map(item => { const department = item.department as unknown as { name?: string } | null; const position = item.position as unknown as { title?: string } | null; return [item.full_name, item.status, department?.name, position?.title, item.hire_date, item.termination_date]; }));
  }
  if (requestedCards.includes("goals")) {
    section(rows, "METAS", ["Colaborador", "Meta", "Status", "Progresso", "Peso", "Prazo"], (goals.data ?? []).map(item => { const employee = item.employee as unknown as { full_name?: string } | null; return [employee?.full_name, item.title, GOAL_STATUS_LABELS[item.status as keyof typeof GOAL_STATUS_LABELS] ?? item.status, `${item.progress}%`, item.weight, item.due_on]; }));
  }
  if (requestedCards.includes("reviews")) {
    section(rows, "AVALIAÇÕES", ["Colaborador", "Status", "Nota", "Criada em"], (reviews.data ?? []).map(item => { const employee = item.employee as unknown as { full_name?: string } | null; return [employee?.full_name, item.status, item.overall_rating, item.created_at]; }));
    section(rows, "CHECK-INS 1:1", ["Colaborador", "Humor", "Energia", "Data"], (checkins.data ?? []).map(item => { const employee = item.employee as unknown as { full_name?: string } | null; return [employee?.full_name, item.mood, item.energy, item.happened_on]; }));
  }
  if (requestedCards.includes("engagement")) {
    section(rows, "CLIMA & ENGAJAMENTO", ["Pesquisa", "Tipo", "Status", "Início", "Fim", "Criada em"], (surveys.data ?? []).map(item => [item.title, item.kind, item.status, item.starts_on, item.ends_on, item.created_at]));
  }
  if (requestedCards.includes("time_off")) {
    section(rows, "FÉRIAS & AUSÊNCIAS", ["Colaborador", "Política", "Status", "Início", "Fim", "Dias"], (leaves.data ?? []).map(item => { const employee = item.employee as unknown as { full_name?: string } | null; const policy = item.policy as unknown as { name?: string } | null; return [employee?.full_name, policy?.name, item.status, item.start_date, item.end_date, item.total_days]; }));
  }

  const csv = rowsToCsv(rows);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="prismae-relatorio-${period.from}-a-${period.to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
