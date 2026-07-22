import Link from "next/link";
import { SubmitButton } from "../_components/submit-button";
import { requireWorkspace } from "@/lib/auth/workspace";
import { canViewPeople } from "@/lib/domain/team";
import { markNotificationRead } from "./actions";

type Notification = { id: string; kind: string; title: string; body: string | null; href: string | null; read_at: string | null; created_at: string };

function relativeTime(value: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(value));
}

export default async function WorkCenterPage() {
  const { supabase, tenant, user, membership } = await requireWorkspace();
  const peopleAccess = canViewPeople(membership.role);
  const now = new Date().toISOString();
  const inThirtyDays = new Date(new Date(now).getTime() + 30 * 86400000).toISOString().slice(0, 10);
  const [notificationsResult, activitiesResult, workflowResult, leaveResult, documentsResult] = await Promise.all([
    supabase.from("app_notifications").select("id,kind,title,body,href,read_at,created_at").eq("tenant_id", tenant.id).eq("user_id", user.id).order("created_at", { ascending: false }).limit(80),
    supabase.from("activities").select("id,subject,activity_type,due_at").eq("tenant_id", tenant.id).is("completed_at", null).lt("due_at", now).order("due_at").limit(20),
    peopleAccess ? supabase.from("employee_workflow_tasks").select("id,title,due_date,workflow:employee_workflows(employee:employees(full_name))").eq("tenant_id", tenant.id).is("completed_at", null).lte("due_date", inThirtyDays).order("due_date").limit(20) : Promise.resolve({ data: [], error: null }),
    peopleAccess ? supabase.from("leave_requests").select("id,start_date,end_date,employee:employees(full_name),policy:leave_policies(name)").eq("tenant_id", tenant.id).eq("status", "pending").order("created_at").limit(20) : Promise.resolve({ data: [], error: null }),
    peopleAccess ? supabase.from("employee_documents").select("id,title,expires_on,employee:employees(full_name)").eq("tenant_id", tenant.id).not("expires_on", "is", null).lte("expires_on", inThirtyDays).order("expires_on").limit(20) : Promise.resolve({ data: [], error: null }),
  ]);
  const notifications = (notificationsResult.data ?? []) as Notification[];
  const unread = notifications.filter(item => !item.read_at);
  const activities = activitiesResult.data ?? [];
  const workflowTasks = workflowResult.data ?? [];
  const leaves = leaveResult.data ?? [];
  const documents = documentsResult.data ?? [];
  const totalPending = activities.length + workflowTasks.length + leaves.length + documents.length;

  return <div className="workspace-content work-center-page">
    <div className="page-heading"><div><p className="page-eyebrow">CENTRAL DE TRABALHO</p><h1>O que precisa de você</h1><p>Notificações, aprovações, prazos e riscos reunidos por prioridade.</p></div>{unread.length > 0 && <form action={markNotificationRead}><input type="hidden" name="notification_id" value="all" /><SubmitButton className="secondary-button" pendingLabel="Limpando...">Marcar tudo como lido</SubmitButton></form>}</div>
    {notificationsResult.error && <div className="setup-notice"><strong>Central aguardando configuração</strong><span>Execute a migração <code>202607220008_timeoff_automations.sql</code>.</span></div>}
    <section className="work-center-hero"><div><span>{unread.length}</span><p><strong>notificações novas</strong><small>Informações direcionadas para o seu usuário</small></p></div><div><span>{totalPending}</span><p><strong>pendências operacionais</strong><small>Atividades, jornadas, documentos e aprovações</small></p></div><Link href="/app/agenda">Organizar agenda →</Link></section>
    <section className="work-center-layout">
      <article className="panel notification-inbox"><div className="panel-heading"><div><h2>Caixa de entrada</h2><p>Eventos importantes do seu ambiente.</p></div><span className="record-count">{unread.length} novas</span></div>{notifications.length ? <div className="notification-list">{notifications.map(item => <article className={!item.read_at ? "is-unread" : ""} key={item.id}><span className={`notification-kind notification-${item.kind}`}>{item.kind === "success" ? "✓" : item.kind === "warning" ? "!" : item.kind === "action" ? "→" : "i"}</span><div><strong>{item.title}</strong>{item.body && <p>{item.body}</p>}<small>{relativeTime(item.created_at)}</small></div><div>{item.href && <Link href={item.href}>Abrir</Link>}{!item.read_at && <form action={markNotificationRead}><input type="hidden" name="notification_id" value={item.id} /><SubmitButton pendingLabel="...">Lida</SubmitButton></form>}</div></article>)}</div> : <div className="empty-state">Sua caixa de entrada está limpa.</div>}</article>
      <aside className="work-center-priorities">
        <article className="panel priority-card"><header><span className="priority-red">!</span><div><h2>Atrasos</h2><p>{activities.length} atividade(s) fora do prazo</p></div><Link href="/app/agenda">Ver</Link></header>{activities.slice(0, 4).map(item => <div key={item.id}><strong>{item.subject}</strong><small>{item.due_at ? new Date(item.due_at).toLocaleString("pt-BR") : "Sem prazo"}</small></div>)}</article>
        {peopleAccess && <article className="panel priority-card"><header><span className="priority-blue">✓</span><div><h2>Aprovações</h2><p>{leaves.length} ausência(s) pendente(s)</p></div><Link href="/app/ausencias">Ver</Link></header>{leaves.slice(0, 4).map(item => { const employee = item.employee as unknown as { full_name?: string } | null; const policy = item.policy as unknown as { name?: string } | null; return <div key={item.id}><strong>{employee?.full_name ?? "Colaborador"}</strong><small>{policy?.name ?? "Ausência"} · {item.start_date}</small></div>; })}</article>}
        {peopleAccess && <article className="panel priority-card"><header><span className="priority-coral">◇</span><div><h2>Documentos</h2><p>{documents.length} vencendo em 30 dias</p></div><Link href="/app/pessoas">Ver</Link></header>{documents.slice(0, 4).map(item => { const employee = item.employee as unknown as { full_name?: string } | null; return <div key={item.id}><strong>{item.title}</strong><small>{employee?.full_name ?? "Colaborador"} · {item.expires_on}</small></div>; })}</article>}
        {peopleAccess && <article className="panel priority-card"><header><span className="priority-green">↗</span><div><h2>Jornadas</h2><p>{workflowTasks.length} tarefa(s) próximas do prazo</p></div><Link href="/app/pessoas">Ver</Link></header>{workflowTasks.slice(0, 4).map(item => { const workflow = item.workflow as unknown as { employee?: { full_name?: string } | null } | null; return <div key={item.id}><strong>{item.title}</strong><small>{workflow?.employee?.full_name ?? "Colaborador"} · {item.due_date ?? "Sem prazo"}</small></div>; })}</article>}
      </aside>
    </section>
  </div>;
}
