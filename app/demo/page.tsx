"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { formatBRL, PLAN_CATALOG } from "@/lib/subscriptions";
import "./demo.css";

type Panel = "overview" | "crm" | "jobs" | "candidates" | "people" | "performance" | "engagement" | "automations" | "reports" | "subscription" | "security";

const navGroups: { label: string; items: { id: Panel; label: string; icon: string; badge?: string }[] }[] = [
  { label: "Principal", items: [{ id: "overview", label: "Visão geral", icon: "⌂" }, { id: "crm", label: "Comercial", icon: "◎", badge: "8" }] },
  { label: "Talentos", items: [{ id: "jobs", label: "Vagas e processos", icon: "▱", badge: "12" }, { id: "candidates", label: "Candidatos", icon: "◉" }] },
  { label: "Gestão de pessoas", items: [{ id: "people", label: "Colaboradores", icon: "♙" }, { id: "performance", label: "Desempenho e PDI", icon: "◇" }, { id: "engagement", label: "Clima e engajamento", icon: "♡" }] },
  { label: "Inteligência", items: [{ id: "automations", label: "Automações", icon: "⎇" }, { id: "reports", label: "Relatórios", icon: "▤" }] },
  { label: "Conta", items: [{ id: "subscription", label: "Plano e assinatura", icon: "◇" }, { id: "security", label: "Segurança e auditoria", icon: "⌾" }] },
];

const candidatesBase = [
  { name: "Fernanda Silva", initials: "FS", role: "Analista de RH Pleno", job: "Analista de RH", stage: "Entrevista", score: 92, source: "LinkedIn", owner: "Mariana", last: "Há 10 min" },
  { name: "Rafael Albuquerque", initials: "RA", role: "Analista de Dados", job: "Analista de Dados", stage: "Avaliação", score: 88, source: "Indicação", owner: "Carlos", last: "Há 38 min" },
  { name: "Carla Mendes", initials: "CM", role: "Gerente de Projetos", job: "Gerente de Projetos", stage: "Proposta", score: 95, source: "Banco de talentos", owner: "Mariana", last: "Há 1 h" },
  { name: "Gabriel Vargas", initials: "GV", role: "Executivo de Contas", job: "Executivo Comercial", stage: "Triagem", score: 79, source: "Página de carreiras", owner: "Júlia", last: "Há 2 h" },
  { name: "Lucas Costa", initials: "LC", role: "Desenvolvedor Back-end", job: "Desenvolvedor Sênior", stage: "Entrevista", score: 86, source: "LinkedIn", owner: "Carlos", last: "Ontem" },
  { name: "Beatriz Lima", initials: "BL", role: "Assistente Financeiro", job: "Assistente Financeiro", stage: "Triagem", score: 83, source: "Indeed", owner: "Júlia", last: "Ontem" },
];

const panelMeta: Record<Panel, { eyebrow: string; title: string; description: string }> = {
  overview: { eyebrow: "Operação em tempo real", title: "Bom dia, Ana 👋", description: "Aqui está o que merece sua atenção hoje." },
  crm: { eyebrow: "CRM para consultorias", title: "Pipeline comercial", description: "Acompanhe oportunidades, propostas, contratos e receita prevista." },
  jobs: { eyebrow: "ATS colaborativo", title: "Vagas e processos seletivos", description: "Gerencie o funil, os SLAs e a comunicação de cada vaga." },
  candidates: { eyebrow: "Banco de talentos", title: "Candidatos", description: "Uma base pesquisável, atualizada e reutilizável em qualquer processo." },
  people: { eyebrow: "Jornada do colaborador", title: "Pessoas", description: "Documentos, contratos, férias e histórico em uma linha do tempo única." },
  performance: { eyebrow: "Talento e sucessão", title: "Desempenho e desenvolvimento", description: "Ciclos, metas, 1:1, PDI, competências e matriz 9-box." },
  engagement: { eyebrow: "Escuta contínua", title: "Clima e engajamento", description: "Transforme pesquisas e feedbacks em planos de ação mensuráveis." },
  automations: { eyebrow: "Operação sem retrabalho", title: "Automações", description: "Gatilhos, condições e ações para manter cada processo em movimento." },
  reports: { eyebrow: "People Analytics", title: "Relatórios e indicadores", description: "Cruze comercial, recrutamento e pessoas em dashboards acionáveis." },
  subscription: { eyebrow: "Plano Pro", title: "Assinatura e limites", description: "Acompanhe uso, faturas e os direitos liberados para sua empresa." },
  security: { eyebrow: "Controle e conformidade", title: "Segurança e auditoria", description: "Permissões, sessões, exportações e eventos sensíveis sob controle." },
};

function Logo() {
  return <span className="demo-logo"><i><b /></i><strong>Prismae</strong><small>People OS</small></span>;
}

function Avatar({ initials, color = "blue" }: { initials: string; color?: string }) {
  return <span className={`avatar ${color}`}>{initials}</span>;
}

function Trend({ children, down = false }: { children: React.ReactNode; down?: boolean }) {
  return <span className={`trend ${down ? "down" : ""}`}>{down ? "↘" : "↗"} {children}</span>;
}

function Metric({ label, value, change, accent = "blue", note }: { label: string; value: string; change: string; accent?: string; note?: string }) {
  return <article className={`metric-card ${accent}`}><div><span>{label}</span><i /></div><strong>{value}</strong><footer><Trend>{change}</Trend><small>{note ?? "vs. mês anterior"}</small></footer></article>;
}

function Overview({ onNavigate }: { onNavigate: (panel: Panel) => void }) {
  return <>
    <section className="demo-metrics">
      <Metric label="Receita prevista" value="R$ 184,2 mil" change="18,4%" accent="blue" />
      <Metric label="Vagas ativas" value="48" change="12,0%" accent="violet" />
      <Metric label="Candidatos no funil" value="842" change="9,6%" accent="coral" />
      <Metric label="Retenção em 12 meses" value="92,4%" change="5,2 p.p." accent="green" />
    </section>
    <section className="overview-grid">
      <article className="panel recruitment-funnel">
        <div className="panel-title"><div><span>Recrutamento</span><h3>Funil de candidatos</h3></div><button onClick={() => onNavigate("jobs")}>Ver processos →</button></div>
        <div className="funnel-summary"><div><strong>842</strong><small>candidatos ativos</small></div><div><strong>32</strong><small>contratados no mês</small></div><div><strong>24 dias</strong><small>tempo médio</small></div></div>
        <div className="funnel-track">
          {[['Inscritos','842','100%'],['Triagem','412','48,9%'],['Entrevista','198','23,5%'],['Proposta','78','9,3%'],['Contratados','32','3,8%']].map(([stage,total,rate], index) => <div key={stage}><i style={{width:`${100-index*13}%`}} /><span>{stage}<b>{total}</b><small>{rate}</small></span></div>)}
        </div>
      </article>
      <article className="panel today-panel">
        <div className="panel-title"><div><span>Agenda</span><h3>Próximos compromissos</h3></div><button>Hoje⌄</button></div>
        {[
          ["09:30","Entrevista · Analista de Dados","Rafael Albuquerque","violet"],
          ["11:00","Alinhamento de perfil","Acme Logística","blue"],
          ["14:00","1:1 mensal","Beatriz Lima","coral"],
          ["16:30","Apresentação de shortlist","Vértice Tech","green"],
        ].map(([time,title,person,color]) => <div className="agenda-row" key={time}><time>{time}</time><i className={color} /><p><b>{title}</b><span>{person}</span></p><button>•••</button></div>)}
      </article>
      <article className="panel attention-panel">
        <div className="panel-title"><div><span>Prioridades</span><h3>Precisa de atenção</h3></div><button>Ver tudo</button></div>
        {[
          ["7 vagas fora do SLA", "3 clientes aguardando avanço", "Vagas", "critical"],
          ["12 documentos vencendo", "Nos próximos 30 dias", "Pessoas", "warning"],
          ["4 aprovações pendentes", "Propostas e requisições", "Fluxos", "info"],
        ].map(([title,text,tag,type]) => <div className="attention-row" key={title}><span className={type}>!</span><p><b>{title}</b><small>{text}</small></p><em>{tag}</em></div>)}
      </article>
      <article className="panel ai-insight-panel">
        <div className="ai-orb">✦</div><span>Insight Prismae</span><h3>O gargalo desta semana está antes da entrevista.</h3><p>41% dos candidatos aprovados na triagem aguardam retorno do gestor há mais de 48 horas.</p><button onClick={() => onNavigate("reports")}>Analisar gargalo →</button>
      </article>
      <article className="panel revenue-panel">
        <div className="panel-title"><div><span>Comercial</span><h3>Receita por cliente</h3></div><button onClick={() => onNavigate("crm")}>Abrir CRM →</button></div>
        <div className="revenue-chart"><div className="chart-y"><span>200k</span><span>150k</span><span>100k</span><span>50k</span><span>0</span></div><div className="chart-bars">{[48,58,44,67,72,62,81,76,88,92,84,96].map((height,index)=><i key={index} style={{height:`${height}%`}} />)}</div></div>
      </article>
    </section>
  </>;
}

const crmColumns = [
  { title: "Prospecção", value: "R$ 86 mil", color: "gray", cards: [["Inova Facilities","R$ 18.000","3 vagas"],["Grupo Horizonte","R$ 42.000","8 vagas"],["Norte Sul Log","R$ 26.000","5 vagas"]] },
  { title: "Diagnóstico", value: "R$ 112 mil", color: "blue", cards: [["Atria Saúde","R$ 64.000","12 vagas"],["K2 Tecnologia","R$ 32.000","6 vagas"],["Órbita Contábil","R$ 16.000","2 vagas"]] },
  { title: "Proposta", value: "R$ 74 mil", color: "violet", cards: [["Nova Engenharia","R$ 38.000","Proposta enviada"],["Vértice Tech","R$ 24.000","Negociação"],["Cooper Mais","R$ 12.000","Revisão jurídica"]] },
  { title: "Contrato", value: "R$ 49 mil", color: "green", cards: [["Acme Logística","R$ 29.000","Assinatura hoje"],["Lumina Foods","R$ 20.000","Onboarding"]] },
];

function CRM() {
  return <><section className="demo-metrics compact"><Metric label="Pipeline total" value="R$ 321 mil" change="14,2%" /><Metric label="Receita ponderada" value="R$ 184 mil" change="18,4%" accent="green" /><Metric label="Conversão" value="28,6%" change="3,1 p.p." accent="violet" /><Metric label="Ciclo médio" value="21 dias" change="2 dias" accent="coral" note="mais rápido" /></section><section className="crm-board">{crmColumns.map(column=><article key={column.title} className={`crm-column ${column.color}`}><header><div><i /><b>{column.title}</b><span>{column.cards.length}</span></div><strong>{column.value}</strong></header>{column.cards.map(([company,value,note])=><div className="deal-card" key={company}><div><Avatar initials={company.split(' ').map(w=>w[0]).join('').slice(0,2)} color={column.color}/><button>•••</button></div><h4>{company}</h4><p>{note}</p><footer><b>{value}</b><span>AM</span></footer></div>)}<button className="add-card">＋ Adicionar oportunidade</button></article>)}</section></>;
}

const pipeline = [
  { stage: "Triagem", count: 76, color: "blue", people: [["Fernanda Silva","92%","FS"],["Beatriz Lima","83%","BL"],["Gabriel Vargas","79%","GV"]] },
  { stage: "Entrevista RH", count: 28, color: "violet", people: [["Lucas Costa","86%","LC"],["Aline Souza","84%","AS"],["Pedro Ramos","81%","PR"]] },
  { stage: "Gestor", count: 12, color: "orange", people: [["Rafael Albuquerque","88%","RA"],["Camila Nunes","87%","CN"]] },
  { stage: "Proposta", count: 5, color: "coral", people: [["Carla Mendes","95%","CM"],["Igor Mattos","89%","IM"]] },
  { stage: "Contratado", count: 2, color: "green", people: [["Juliana Lima","94%","JL"],["Diego Nunes","91%","DN"]] },
];

function Jobs() {
  const [selected, setSelected] = useState("Analista de RH Pleno");
  return <><section className="job-toolbar panel"><div><span className="status-dot green" /> <b>{selected}</b><small>Acme Logística · Joinville, SC · Híbrido</small></div><div><span><b>12</b> dias ativa</span><span><b>3</b> posições</span><span><b>121</b> no funil</span><select value={selected} onChange={e=>setSelected(e.target.value)}><option>Analista de RH Pleno</option><option>Analista de Dados</option><option>Executivo Comercial</option></select></div></section><section className="ats-board">{pipeline.map(column=><article className={`ats-column ${column.color}`} key={column.stage}><header><div><i /><b>{column.stage}</b><span>{column.count}</span></div><button>•••</button></header>{column.people.map(([name,score,initials])=><div className="candidate-card" key={name}><div><Avatar initials={initials} color={column.color}/><button>•••</button></div><h4>{name}</h4><p>Analista de Recursos Humanos</p><footer><span>Fit <b>{score}</b></span><small>Há 2 h</small></footer></div>)}<button className="add-card">＋ Adicionar candidato</button></article>)}</section></>;
}

function Candidates({ candidates, onAdd }: { candidates: typeof candidatesBase; onAdd: () => void }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(()=>candidates.filter(candidate=>`${candidate.name} ${candidate.role} ${candidate.job}`.toLowerCase().includes(query.toLowerCase())),[candidates,query]);
  return <section className="panel data-panel"><div className="data-toolbar"><div className="table-search">⌕ <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar por nome, cargo ou habilidade" /></div><button className="filter-button">☷ Filtros <span>2</span></button><button className="filter-button">⇩ Exportar</button><button className="primary-action" onClick={onAdd}>＋ Novo candidato</button></div><div className="saved-filters"><button className="active">Todos <span>{candidates.length + 2840}</span></button><button>Alto potencial <span>84</span></button><button>Disponíveis <span>628</span></button><button>Contatados recentemente <span>42</span></button></div><div className="data-table candidate-table"><div className="table-head"><span>Candidato</span><span>Vaga atual</span><span>Etapa</span><span>Fit</span><span>Origem</span><span>Responsável</span><span>Atualização</span></div>{filtered.map((candidate,index)=><div className="table-row" key={`${candidate.name}-${index}`}><span className="person-cell"><Avatar initials={candidate.initials} color={['blue','violet','coral','green'][index%4]}/><span><b>{candidate.name}</b><small>{candidate.role}</small></span></span><span>{candidate.job}</span><span><em className={`stage stage-${candidate.stage.toLowerCase().replace('ç','c')}`}>{candidate.stage}</em></span><span><b className={candidate.score>90?'high-score':''}>{candidate.score}%</b></span><span>{candidate.source}</span><span>{candidate.owner}</span><span className="muted-cell">{candidate.last}<button>•••</button></span></div>)}</div><footer className="table-footer"><span>Mostrando {filtered.length} de 2.846 candidatos</span><div><button disabled>‹</button><button className="active">1</button><button>2</button><button>3</button><button>…</button><button>143</button><button>›</button></div></footer></section>;
}

const employees = [
  ["Mariana Costa","MC","Coord. de Recrutamento","Talentos","Ativo","12/03/2022"],
  ["Carlos Almeida","CA","Recrutador Sênior","Talentos","Ativo","08/07/2023"],
  ["Júlia Ferreira","JF","Recrutadora Pleno","Talentos","Férias","21/11/2023"],
  ["Beatriz Lima","BL","Assistente Financeiro","Financeiro","Ativo","02/02/2024"],
  ["Rafael Souza","RS","Analista de Dados","Tecnologia","Ativo","15/04/2024"],
  ["Laura Martins","LM","Customer Success","Sucesso do Cliente","Afastado","01/08/2024"],
];

function People() {
  return <><section className="demo-metrics compact"><Metric label="Colaboradores ativos" value="128" change="6,7%"/><Metric label="Em férias" value="8" change="2 pessoas" accent="violet" note="próximos 30 dias"/><Metric label="Documentos pendentes" value="12" change="4 resolvidos" accent="coral" note="esta semana"/><Metric label="Tempo de casa médio" value="2,8 anos" change="0,3 ano" accent="green"/></section><section className="people-layout"><article className="panel data-panel"><div className="data-toolbar"><div className="table-search">⌕ <input placeholder="Buscar colaborador" /></div><button className="filter-button">☷ Filtros</button><button className="primary-action">＋ Novo colaborador</button></div><div className="data-table people-table"><div className="table-head"><span>Colaborador</span><span>Cargo</span><span>Área</span><span>Status</span><span>Admissão</span></div>{employees.map(([name,initials,role,area,status,date],index)=><div className="table-row" key={name}><span className="person-cell"><Avatar initials={initials} color={['blue','violet','coral','green'][index%4]}/><span><b>{name}</b><small>{name.toLowerCase().replace(' ','.')}@empresa.com</small></span></span><span>{role}</span><span>{area}</span><span><em className={`employee-status ${status.toLowerCase().replace('é','e')}`}>{status}</em></span><span>{date}<button>•••</button></span></div>)}</div></article><aside className="people-aside"><article className="panel"><div className="panel-title"><div><span>Este mês</span><h3>Aniversários</h3></div><button>Ver todos</button></div>{[["22 jul","Ana Moraes","AM"],["25 jul","Carlos Almeida","CA"],["29 jul","Laura Martins","LM"]].map(([date,name,initials])=><div className="birthday-row" key={name}><time>{date}</time><Avatar initials={initials}/><b>{name}</b><button>Enviar mensagem</button></div>)}</article><article className="panel"><div className="panel-title"><div><span>Capacidade</span><h3>Distribuição por área</h3></div></div>{[["Operações",42],["Talentos",31],["Comercial",24],["Tecnologia",18],["Outros",13]].map(([area,count])=><div className="area-row" key={area}><span>{area}</span><i><b style={{width:`${Number(count)*2}%`}} /></i><strong>{count}</strong></div>)}</article></aside></section></>;
}

function Performance() {
  const boxes = [
    ["Enigma", "#e8e9f4", 1], ["Forte potencial", "#dfe7ff", 3], ["Alto potencial", "#dcefe8", 5],
    ["Eficaz", "#f0eee7", 4], ["Destaque", "#e5e9fb", 8], ["Futuro líder", "#d9eee5", 6],
    ["Atenção", "#f7e4df", 2], ["Consistente", "#eee8f7", 7], ["Alta performance", "#dcefe8", 4],
  ] as const;

  return (
    <section className="performance-layout">
      <div>
        <article className="panel cycle-card">
          <div className="cycle-copy">
            <span>Ciclo ativo · 2º semestre</span>
            <h3>Avaliação de desempenho 2026</h3>
            <p>92 de 128 avaliações concluídas</p>
            <div><i><b style={{ width: "72%" }} /></i></div>
            <footer>
              <span><b>72%</b> concluído</span>
              <span>Encerra em <b>18 dias</b></span>
              <button>Abrir ciclo →</button>
            </footer>
          </div>
          <div className="cycle-ring"><strong>72%</strong><small>concluído</small></div>
        </article>
        <article className="panel pdi-list">
          <div className="panel-title"><div><span>Desenvolvimento</span><h3>PDIs em andamento</h3></div><button>Ver todos</button></div>
          {[
            ["Fernanda Silva", "Liderança e gestão", "68%", "FS"],
            ["Carlos Almeida", "Negociação consultiva", "42%", "CA"],
            ["Beatriz Lima", "Análise financeira", "81%", "BL"],
            ["Rafael Souza", "Data storytelling", "56%", "RS"],
          ].map(([name, goal, progress, initials]) => (
            <div className="pdi-row" key={name}>
              <Avatar initials={initials} />
              <p><b>{name}</b><span>{goal}</span></p>
              <i><b style={{ width: progress }} /></i>
              <strong>{progress}</strong><button>•••</button>
            </div>
          ))}
        </article>
      </div>
      <article className="panel nine-box">
        <div className="panel-title"><div><span>Sucessão</span><h3>Matriz 9-box</h3></div><button>Filtrar área⌄</button></div>
        <div className="matrix">
          <div className="axis-y">Potencial →</div>
          {boxes.map(([label, color, count]) => (
            <div key={label} style={{ background: color }}>
              <span>{label}</span><strong>{count}</strong>
              <div>{Array.from({ length: Math.min(count, 5) }, (_, index) => <i key={index}>{["AM", "CA", "FS", "BL", "RS"][index]}</i>)}</div>
            </div>
          ))}
          <div className="axis-x">Desempenho →</div>
        </div>
        <footer><span><i className="green" />9 sucessores mapeados</span><span><i className="blue" />12 altos potenciais</span><span><i className="coral" />2 planos de ação</span></footer>
      </article>
    </section>
  );
}

function Engagement() {
  return <><section className="engagement-hero panel"><div><span>eNPS · Julho 2026</span><strong>64</strong><em>Zona de excelência</em><Trend>8 pontos</Trend><p>86% de participação · 110 de 128 respostas</p></div><div className="enps-scale"><i /><i /><i /><span style={{left:'73%'}}>64<b /></span><footer><small>Crítica</small><small>Aperfeiçoamento</small><small>Qualidade</small><small>Excelência</small></footer></div></section><section className="engagement-grid"><article className="panel"><div className="panel-title"><div><span>Pesquisa pulso</span><h3>Como você se sente esta semana?</h3></div><button>Criar pesquisa</button></div>{[["Muito bem",48,"green"],["Bem",35,"blue"],["Neutro",12,"violet"],["Sobrecarregado",5,"coral"]].map(([label,value,color])=><div className="survey-bar" key={label}><span>{label}</span><i><b className={String(color)} style={{width:`${value}%`}} /></i><strong>{value}%</strong></div>)}</article><article className="panel recognition-card"><div className="panel-title"><div><span>Reconhecimento</span><h3>Destaques do mês</h3></div><button>Reconhecer alguém</button></div>{[["Mariana Costa","Colaboração","12 reconhecimentos","MC"],["Rafael Souza","Inovação","9 reconhecimentos","RS"],["Júlia Ferreira","Foco no cliente","8 reconhecimentos","JF"]].map(([name,value,note,initials],index)=><div className="recognition-row" key={name}><span>{index+1}</span><Avatar initials={initials}/><p><b>{name}</b><small>{value}</small></p><em>{note}</em></div>)}</article><article className="panel action-plans"><div className="panel-title"><div><span>Planos de ação</span><h3>Do feedback à mudança</h3></div><button>Ver quadro</button></div>{[["Revisar política de trabalho híbrido","Em andamento","68%"],["Trilha de liderança para coordenadores","Planejado","20%"],["Melhorar comunicação entre áreas","Em andamento","45%"]].map(([title,status,progress])=><div className="action-row" key={title}><span>✓</span><p><b>{title}</b><small>{status}</small></p><i><b style={{width:progress}} /></i><strong>{progress}</strong></div>)}</article></section></>;
}

const automationData = [
  ["Candidato avançou de etapa","Enviar e-mail personalizado ao candidato","342 execuções","Ativa","blue"],
  ["Vaga a 80% do SLA","Alertar responsável e coordenador","18 execuções","Ativa","coral"],
  ["Proposta comercial aprovada","Criar projeto e tarefas de onboarding","12 execuções","Ativa","violet"],
  ["Documento vence em 30 dias","Notificar colaborador e RH","84 execuções","Ativa","green"],
  ["Novo colaborador admitido","Iniciar checklist de onboarding","26 execuções","Pausada","blue"],
  ["Pesquisa de clima encerrada","Gerar resumo e plano sugerido por IA","4 execuções","Rascunho","violet"],
];

function Automations() {
  const [enabled,setEnabled]=useState(automationData.map(item=>item[3]==="Ativa"));
  return <><section className="automation-summary panel"><div><span>Execuções nos últimos 30 dias</span><strong>486</strong><Trend>22%</Trend></div><div><span>Tempo economizado</span><strong>74 h</strong><small>estimativa mensal</small></div><div><span>Taxa de sucesso</span><strong>99,2%</strong><small>4 falhas revisadas</small></div><button className="primary-action">＋ Criar automação</button></section><section className="automation-grid">{automationData.map(([trigger,action,runs,status,color],index)=><article className="panel automation-card" key={trigger}><header><span className={color}>⎇</span><button className={`switch ${enabled[index]?'on':''}`} onClick={()=>setEnabled(current=>current.map((value,i)=>i===index?!value:value))}><i /></button></header><small>Quando</small><h3>{trigger}</h3><div className="connector-line"><i /><span /></div><small>Então</small><p>{action}</p><footer><span>{runs}</span><em className={enabled[index]?'active':'paused'}>{enabled[index]?'Ativa':status==='Rascunho'?'Rascunho':'Pausada'}</em><button>•••</button></footer></article>)}</section></>;
}

function Reports() {
  return <><section className="report-tabs"><button className="active">Executivo</button><button>Comercial</button><button>Recrutamento</button><button>Pessoas</button><button>Personalizados</button><span /><button>＋ Novo dashboard</button></section><section className="demo-metrics compact"><Metric label="Time to hire" value="24 dias" change="3 dias" accent="blue" note="mais rápido"/><Metric label="Custo por contratação" value="R$ 1.840" change="7,4%" accent="green" note="menor custo"/><Metric label="Receita por recrutador" value="R$ 38,6 mil" change="11,2%" accent="violet"/><Metric label="Turnover 12 meses" value="8,1%" change="1,6 p.p." accent="coral" note="abaixo da meta"/></section><section className="reports-grid"><article className="panel report-line"><div className="panel-title"><div><span>Visão consolidada</span><h3>Contratações e receita</h3></div><button>Últimos 12 meses⌄</button></div><div className="line-chart"><div className="grid-lines"><i/><i/><i/><i/></div><svg viewBox="0 0 760 230" preserveAspectRatio="none"><defs><linearGradient id="reportArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3156d8" stopOpacity=".25"/><stop offset="1" stopColor="#3156d8" stopOpacity="0"/></linearGradient></defs><path className="report-area" d="M0 200C80 180 90 120 160 145S260 165 320 95S410 125 470 70S560 110 620 42S710 60 760 18L760 230H0Z"/><path className="report-stroke" d="M0 200C80 180 90 120 160 145S260 165 320 95S410 125 470 70S560 110 620 42S710 60 760 18"/></svg><footer>{['Ago','Set','Out','Nov','Dez','Jan','Fev','Mar','Abr','Mai','Jun','Jul'].map(month=><span key={month}>{month}</span>)}</footer></div></article><article className="panel source-report"><div className="panel-title"><div><span>Aquisição</span><h3>Qualidade por origem</h3></div><button>•••</button></div><div className="source-donut"><div><strong>842</strong><small>candidatos</small></div></div>{[["LinkedIn",46,"blue"],["Indicação",24,"violet"],["Página de carreiras",18,"coral"],["Outros",12,"gray"]].map(([source,value,color])=><p key={source}><i className={String(color)}/><span>{source}</span><b>{value}%</b></p>)}</article><article className="panel client-ranking"><div className="panel-title"><div><span>Rentabilidade</span><h3>Clientes por resultado</h3></div><button>Ver relatório</button></div>{[["Acme Logística","R$ 48,2 mil","94%","AL"],["Vértice Tech","R$ 36,8 mil","91%","VT"],["Atria Saúde","R$ 31,4 mil","88%","AS"],["Nova Engenharia","R$ 28,6 mil","86%","NE"]].map(([client,revenue,sla,initials],index)=><div className="ranking-row" key={client}><strong>{index+1}</strong><Avatar initials={initials}/><p><b>{client}</b><span>SLA {sla}</span></p><em>{revenue}</em></div>)}</article></section></>;
}

const planFeatures = [
  ["Usuários","5","20","Sob medida"],["Colaboradores","100","500","Sob medida"],["Vagas ativas","10","Ampliadas","Sob medida"],["CRM + ATS","Incluído","Incluído","Incluído"],["Automações","—","Incluído","Avançadas"],["IA Prismae","—","Incluído","Dedicada"],["API e webhooks","—","Incluído","Customizados"],["White label e SSO","—","—","Incluído"]
];

function Subscription() {
  const proPrice = formatBRL(PLAN_CATALOG.PRO.priceMonthly ?? 0);
  return <><section className="current-plan panel"><div className="plan-badge">PRO</div><div><span>Seu plano atual</span><h3>Prismae Pro</h3><p>Período de avaliação · termina em 31 de julho de 2026</p></div><div className="trial-days"><strong>11</strong><span>dias restantes</span></div><button className="primary-action">Adicionar forma de pagamento</button></section><section className="subscription-grid"><article className="panel usage-panel"><div className="panel-title"><div><span>Este ciclo</span><h3>Uso do plano</h3></div><small>Renova em 01/08/2026</small></div>{[["Usuários","14 de 20",70],["Colaboradores","128 de 500",26],["Armazenamento","18,4 de 50 GB",37],["Créditos de IA","642 de 1.000",64]].map(([label,value,progress])=><div className="usage-row" key={String(label)}><span>{label}</span><b>{value}</b><i><em style={{width:`${progress}%`}}/></i></div>)}</article><article className="panel billing-panel"><div className="panel-title"><div><span>Cobrança</span><h3>Próxima fatura</h3></div><button>•••</button></div><strong>{proPrice}</strong><p>Vencimento em 01 de agosto de 2026</p><div><span>Plano Pro mensal</span><b>{proPrice}</b></div><div><span>Créditos adicionais</span><b>R$ 0,00</b></div><footer><span>Total previsto</span><b>{proPrice}</b></footer></article></section><section className="panel plan-comparison"><div className="panel-title"><div><span>Entitlements</span><h3>Compare os direitos de cada plano</h3></div><button>Falar com especialista</button></div><div className="plan-table"><div className="plan-row head"><span>Recurso</span><b>Basic<small>R$ 297/mês</small></b><b className="selected">Pro<small>R$ 697/mês</small><em>Atual</em></b><b>Custom<small>Sob consulta</small></b></div>{planFeatures.map(row=><div className="plan-row" key={row[0]}>{row.map((cell,index)=><span key={`${index}-${cell}`} className={index===2?'selected':''}>{cell==='Incluído'?'✓ ':''}{cell}</span>)}</div>)}</div></section></>;
}

function Security() {
  const events = [
    ["Ana Moraes", "Exportou relatório de candidatos", "Hoje, 10:42", "AM", "Exportação"],
    ["Carlos Almeida", "Atualizou salário de colaborador", "Hoje, 09:18", "CA", "Dado sensível"],
    ["Sistema", "Automação alterou etapa de 12 candidatos", "Hoje, 08:30", "PS", "Automação"],
    ["Mariana Costa", "Adicionou usuário ao time Talentos", "Ontem, 17:54", "MC", "Permissão"],
    ["Júlia Ferreira", "Visualizou documento privado", "Ontem, 16:12", "JF", "Acesso"],
  ];
  const checks: [string, boolean][] = [
    ["MFA obrigatório para admins", true], ["Política de senha forte", true],
    ["Retenção de candidatos configurada", true], ["2 usuários sem MFA", false],
    ["Revisão trimestral de acessos", false],
  ];

  return <>
    <section className="security-stats">
      <article className="panel"><span>Postura de segurança</span><strong>Excelente</strong><em>96/100</em><i><b style={{ width: "96%" }} /></i></article>
      <article className="panel"><span>Autenticação em dois fatores</span><strong>12 de 14 usuários</strong><button>Notificar pendentes</button></article>
      <article className="panel"><span>Sessões ativas</span><strong>18</strong><button>Revisar sessões</button></article>
      <article className="panel"><span>Último backup</span><strong>Hoje, 03:00</strong><em className="success">Concluído</em></article>
    </section>
    <section className="security-layout">
      <article className="panel audit-panel">
        <div className="panel-title"><div><span>Rastreabilidade</span><h3>Eventos recentes</h3></div><button>Exportar log</button></div>
        {events.map(([name, action, time, initials, type]) => <div className="audit-row" key={`${name}-${time}`}><Avatar initials={initials} /><p><b>{name}</b><span>{action}</span></p><em>{type}</em><time>{time}</time><button>•••</button></div>)}
      </article>
      <aside>
        <article className="panel security-checklist">
          <div className="panel-title"><div><span>Recomendações</span><h3>Checklist de proteção</h3></div></div>
          {checks.map(([item, done]) => <p key={item}><i className={done ? "done" : ""}>{done ? "✓" : "!"}</i><span>{item}</span></p>)}
        </article>
        <article className="panel lgpd-card"><span>LGPD</span><h3>Central de privacidade</h3><p>4 solicitações concluídas · nenhuma pendente</p><button>Abrir central →</button></article>
      </aside>
    </section>
  </>;
}

function AddCandidateModal({ onClose, onSave }: { onClose: () => void; onSave: (candidate: typeof candidatesBase[number]) => void }) {
  const submit=(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();const data=new FormData(event.currentTarget);const name=String(data.get('name'));onSave({name,initials:name.split(' ').map(part=>part[0]).join('').slice(0,2).toUpperCase(),role:String(data.get('role')),job:String(data.get('job')),stage:'Triagem',score:80,source:'Cadastro manual',owner:'Ana',last:'Agora'});};
  return <div className="demo-modal-backdrop" onMouseDown={onClose}><form className="demo-modal" onSubmit={submit} onMouseDown={event=>event.stopPropagation()}><header><div><span>Novo talento</span><h2>Adicionar candidato</h2></div><button type="button" onClick={onClose} aria-label="Fechar">×</button></header><label>Nome completo<input name="name" required placeholder="Ex.: Amanda Ribeiro"/></label><div className="modal-form-row"><label>Cargo atual<input name="role" required placeholder="Ex.: Analista de RH"/></label><label>Vaga<select name="job" defaultValue="Analista de RH"><option>Analista de RH</option><option>Analista de Dados</option><option>Executivo Comercial</option><option>Banco de talentos</option></select></label></div><label>E-mail<input name="email" required type="email" placeholder="amanda@email.com"/></label><label>Observação<textarea placeholder="Contexto, habilidades ou indicação…"/></label><footer><button type="button" onClick={onClose}>Cancelar</button><button className="primary-action" type="submit">Adicionar candidato</button></footer></form></div>;
}

function AIAssistant({ onClose }: { onClose: () => void }) {
  const [question,setQuestion]=useState(""); const [answer,setAnswer]=useState(false);
  const ask=(event:FormEvent)=>{event.preventDefault();if(question.trim())setAnswer(true)};
  return <aside className="ai-drawer"><header><span>✦</span><div><b>Assistente Prismae</b><small>Contexto: DM Gestão · Plano Pro</small></div><button onClick={onClose}>×</button></header><div className="ai-drawer-body"><div className="assistant-welcome"><span>✦</span><h3>Olá, Ana. O que você quer descobrir?</h3><p>Eu cruzo dados comerciais, recrutamento e pessoas respeitando suas permissões.</p></div><div className="suggestions">{["Quais vagas estão fora do SLA?","Resuma os riscos da semana","Compare meus melhores clientes"].map(text=><button key={text} onClick={()=>setQuestion(text)}>{text}<span>→</span></button>)}</div>{answer&&<><div className="user-bubble"><small>Você</small><p>{question}</p></div><div className="assistant-answer"><span>✦</span><div><small>Prismae</small><p>Encontrei <b>7 vagas fora do SLA</b>, concentradas em três clientes. A Acme Logística representa o maior risco: 3 processos aguardam retorno do gestor há mais de quatro dias.</p><div><span>Pipeline ATS</span><span>SLAs de clientes</span><span>Atualizado agora</span></div></div></div></>}</div><form onSubmit={ask}><input value={question} onChange={event=>setQuestion(event.target.value)} placeholder="Pergunte sobre sua operação…"/><button aria-label="Enviar">↑</button></form></aside>;
}

export default function DemoPage() {
  const [active,setActive]=useState<Panel>("overview"); const [sidebarOpen,setSidebarOpen]=useState(false); const [aiOpen,setAiOpen]=useState(false); const [addOpen,setAddOpen]=useState(false); const [toast,setToast]=useState(""); const [candidates,setCandidates]=useState(candidatesBase);
  const go=(panel:Panel)=>{setActive(panel);setSidebarOpen(false);window.scrollTo({top:0,behavior:'smooth'})};
  const saveCandidate=(candidate:typeof candidatesBase[number])=>{setCandidates(current=>[candidate,...current]);setAddOpen(false);setToast(`${candidate.name} foi adicionado ao banco de talentos.`);setTimeout(()=>setToast(''),3200)};
  const render=()=>{switch(active){case'overview':return <Overview onNavigate={go}/>;case'crm':return <CRM/>;case'jobs':return <Jobs/>;case'candidates':return <Candidates candidates={candidates} onAdd={()=>setAddOpen(true)}/>;case'people':return <People/>;case'performance':return <Performance/>;case'engagement':return <Engagement/>;case'automations':return <Automations/>;case'reports':return <Reports/>;case'subscription':return <Subscription/>;case'security':return <Security/>;}};
  return <main className="demo-app">
    <aside className={`demo-sidebar ${sidebarOpen?'open':''}`}><div className="sidebar-head"><Logo/><button onClick={()=>setSidebarOpen(false)}>×</button></div><div className="company-switch"><span>DM</span><div><b>DM Gestão</b><small>Plano Pro · Avaliação</small></div><button>⌄</button></div><nav>{navGroups.map(group=><div key={group.label}><small>{group.label}</small>{group.items.map(item=><button key={item.id} className={active===item.id?'active':''} onClick={()=>go(item.id)}><i>{item.icon}</i><span>{item.label}</span>{item.badge&&<em>{item.badge}</em>}</button>)}</div>)}</nav><div className="sidebar-upgrade"><span>✦</span><div><b>11 dias de avaliação</b><small>Configure a cobrança para manter o plano Pro.</small></div><button onClick={()=>go('subscription')}>Ver assinatura</button></div><Link className="back-site" href="/">← Voltar para o site</Link></aside>
    <div className="demo-workspace"><header className="demo-topbar"><button className="sidebar-toggle" onClick={()=>setSidebarOpen(true)}>☰</button><div className="global-search">⌕<input placeholder="Buscar clientes, vagas, candidatos ou pessoas…"/><kbd>⌘ K</kbd></div><div className="top-actions"><button title="Ajuda">?</button><button className="notification" title="Notificações">♢<i>4</i></button><button className="new-button" onClick={()=>active==='candidates'?setAddOpen(true):setToast('Menu de criação rápida aberto.')}>＋ Novo</button><button className="profile"><Avatar initials="AM"/><span><b>Ana Moraes</b><small>Administrador</small></span>⌄</button></div></header><div className="demo-page-head"><div><p>{panelMeta[active].eyebrow}</p><h1>{panelMeta[active].title}</h1><span>{panelMeta[active].description}</span></div><div><button className="ghost-action">⇩ Exportar</button><button className="ai-action" onClick={()=>setAiOpen(true)}>✦ Perguntar à IA</button></div></div><div className="demo-content">{render()}</div></div>
    <button className="floating-ai" onClick={()=>setAiOpen(true)} aria-label="Abrir assistente Prismae">✦<span>IA</span></button>
    {aiOpen&&<><div className="drawer-backdrop" onClick={()=>setAiOpen(false)}/><AIAssistant onClose={()=>setAiOpen(false)}/></>}
    {addOpen&&<AddCandidateModal onClose={()=>setAddOpen(false)} onSave={saveCandidate}/>} {toast&&<div className="demo-toast"><span>✓</span>{toast}</div>}
  </main>;
}
