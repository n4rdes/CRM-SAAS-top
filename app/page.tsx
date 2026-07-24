"use client";

import { FormEvent, MouseEvent as ReactMouseEvent, useState } from "react";

declare global { interface Window { dataLayer?: Array<Record<string, unknown>> } }

function trackMarketingEvent(action: string, location: string) {
  window.dataLayer?.push({ event: "prismae_conversion", action, location });
}

function startAttributedTrial(event: ReactMouseEvent<HTMLAnchorElement>, plan: string, location: string) {
  trackMarketingEvent("start_trial",location);
  const current = new URLSearchParams(window.location.search);
  const attribution = new URLSearchParams();
  ["utm_source","utm_medium","utm_campaign","utm_content","utm_term","gclid"].forEach(key => { const value = current.get(key); if (value) attribution.set(key,value); });
  if (!attribution.size) return;
  event.preventDefault();
  sessionStorage.setItem("prismae_attribution",attribution.toString());
  window.location.assign(`/auth/signup?plan=${plan}&${attribution.toString()}`);
}

type IconName =
  | "arrow"
  | "automation"
  | "brain"
  | "briefcase"
  | "chart"
  | "check"
  | "crm"
  | "document"
  | "lock"
  | "people"
  | "play"
  | "shield"
  | "sparkles";

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
    automation: <><path d="M4 6h10" /><path d="m11 3 3 3-3 3" /><path d="M20 18H10" /><path d="m13 15-3 3 3 3" /><circle cx="5" cy="18" r="2" /><circle cx="19" cy="6" r="2" /></>,
    brain: <><path d="M9.5 4A3.5 3.5 0 0 0 6 7.5v.7A3.5 3.5 0 0 0 4 11.4a3.5 3.5 0 0 0 2 3.2v.9A3.5 3.5 0 0 0 9.5 19" /><path d="M14.5 4A3.5 3.5 0 0 1 18 7.5v.7a3.5 3.5 0 0 1 2 3.2 3.5 3.5 0 0 1-2 3.2v.9a3.5 3.5 0 0 1-3.5 3.5" /><path d="M9.5 4v16M14.5 4v16M6 8.2h3.5m5 0H18M6 14.6h3.5m5 0H18" /></>,
    briefcase: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2" /></>,
    chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    crm: <><circle cx="8" cy="8" r="3" /><path d="M3 20a5 5 0 0 1 10 0M16 4h5M16 9h5M16 14h5M16 19h5" /></>,
    document: <><path d="M6 2h9l5 5v15H6z" /><path d="M14 2v6h6M9 13h8M9 17h8" /></>,
    lock: <><rect x="4" y="10" width="16" height="12" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 15v3" /></>,
    people: <><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0M16 5a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 6" /></>,
    play: <path d="m8 5 11 7-11 7z" />,
    shield: <><path d="M12 2 4 5v6c0 5 3.4 9.3 8 11 4.6-1.7 8-6 8-11V5z" /><path d="m8.5 12 2.2 2.2 4.8-5" /></>,
    sparkles: <><path d="m12 3 1.2 3.2L16.5 7.5l-3.3 1.3L12 12l-1.2-3.2-3.3-1.3 3.3-1.3zM19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8zM5 13l.7 1.8 1.8.7-1.8.7L5 18l-.7-1.8-1.8-.7 1.8-.7z" /></>,
  };

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

const featureGroups = [
  {
    icon: "crm" as IconName,
    tag: "Comercial",
    title: "CRM criado para consultorias de RH",
    text: "Organize empresas, contatos, etapas comerciais e próximos passos no mesmo lugar em que o recrutamento acontece.",
    items: ["Funil de empresas", "Contatos e histórico por cliente", "Agenda de follow-ups"],
  },
  {
    icon: "briefcase" as IconName,
    tag: "Recrutamento",
    title: "ATS que acompanha a vaga até a contratação",
    text: "Abra vagas, centralize candidatos e conduza cada candidatura em uma seleção simples, colaborativa e rastreável.",
    items: ["Banco único de talentos", "Pipeline por vaga", "Avaliações e histórico de etapas"],
  },
  {
    icon: "people" as IconName,
    tag: "Pessoas",
    title: "A jornada não termina na admissão",
    text: "Transforme o candidato contratado em colaborador sem recadastrar dados. Conduza onboarding, documentos, férias, desempenho, PDI e clima.",
    items: ["Diretório e documentos", "Onboarding e offboarding", "Desempenho, PDI e eNPS"],
  },
  {
    icon: "automation" as IconName,
    tag: "Operação",
    title: "Uma operação que não depende da memória",
    text: "Centralize tarefas, ligações, reuniões, entrevistas e prazos. Cada próximo passo ganha contexto e histórico de execução.",
    items: ["Agenda operacional", "Responsáveis e vencimentos", "Trilha de auditoria"],
  },
  {
    icon: "brain" as IconName,
    tag: "Desempenho",
    title: "Metas, avaliações e 1:1 com continuidade",
    text: "Conecte resultados, conversas de desenvolvimento e avaliações periódicas ao histórico real de cada colaborador.",
    items: ["OKRs e metas ponderadas", "Ciclos e calibração", "Check-ins 1:1"],
  },
  {
    icon: "chart" as IconName,
    tag: "Analytics",
    title: "Do lead à retenção, sem relatórios quebrados",
    text: "Cruze aquisição, recrutamento, receita e pessoas para entender o que realmente gera resultado para cada cliente e unidade.",
    items: ["Dashboards por perfil", "Indicadores operacionais", "eNPS e planos de ação"],
  },
];

const plans = [
  {
    id: "basic",
    name: "Basic",
    description: "Para pequenas empresas e consultorias organizarem a operação.",
    monthly: 297,
    annual: 247,
    features: ["Até 5 usuários", "Até 100 colaboradores", "10 vagas ativas", "CRM + ATS completos", "Diretório e documentos", "Relatórios essenciais"],
  },
  {
    id: "pro",
    name: "Pro",
    description: "Para operações que querem automatizar e crescer com dados.",
    monthly: 697,
    annual: 581,
    popular: true,
    features: ["Até 20 usuários", "Até 500 colaboradores", "Vagas ativas ampliadas", "Agenda e trilha operacional", "Desempenho, OKRs e 1:1", "Clima, eNPS e reconhecimento", "People Analytics"],
  },
  {
    id: "custom",
    name: "Custom",
    description: "Para grandes empresas, grupos e operações com alta complexidade.",
    custom: true,
    features: ["Usuários e volumes sob medida", "Multi-CNPJ e múltiplas unidades", "SSO e segurança avançada", "White label e domínio próprio", "Integrações personalizadas", "SLA e implantação dedicada"],
  },
];

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand ${compact ? "brand-compact" : ""}`}>
      <span className="brand-mark" aria-hidden="true"><span /></span>
      <span>Prismae</span>
      {!compact && <small>People OS</small>}
    </span>
  );
}

function DashboardMock() {
  const candidates = [
    ["Fernanda Silva", "Analista de RH", "FS"],
    ["Rafael Albuquerque", "Analista de Dados", "RA"],
    ["Carla Mendes", "Gerente de Projetos", "CM"],
    ["Gabriel Vargas", "Gerente de Contas", "GV"],
  ];

  return (
    <div className="dashboard-shell" aria-label="Prévia do painel Prismae">
      <div className="dashboard-topbar">
        <Brand compact />
        <div className="mock-search">⌕&nbsp;&nbsp; Buscar no Prismae</div>
        <div className="mock-user"><span>AM</span><b>Ana Moraes</b><small>Admin</small></div>
      </div>
      <div className="dashboard-body">
        <aside className="mock-sidebar">
          {['Visão geral', 'Agenda', 'Clientes', 'Vagas', 'Candidatos', 'Pessoas', 'Desempenho', 'Clima & eNPS', 'Relatórios'].map((item, index) => (
            <span key={item} className={index === 0 ? "active" : ""}><i />{item}</span>
          ))}
        </aside>
        <div className="mock-content">
          <div className="mock-title"><b>Visão geral</b><span>Últimos 30 dias⌄</span></div>
          <div className="mock-metrics">
            {[
              ["Vagas ativas", "48", "+12%", "blue"],
              ["Candidatos", "256", "+18%", "violet"],
              ["Clientes", "32", "+8%", "coral"],
              ["Retenção", "92%", "+5 p.p.", "coral"],
            ].map(([label, value, growth, color]) => (
              <article key={label}>
                <span className={`metric-icon ${color}`}><i /></span>
                <small>{label}</small>
                <strong>{value}</strong>
                <em>↗ {growth} vs. mês anterior</em>
                <svg viewBox="0 0 120 26" preserveAspectRatio="none" aria-hidden="true"><path d="M0 23 C14 9, 25 22, 38 15 S58 7, 71 13 S93 21,120 3" /></svg>
              </article>
            ))}
          </div>
          <div className="mock-grid">
            <article className="pipeline-card">
              <header><b>Pipeline de candidatos</b><span>Vaga: Analista de RH⌄</span></header>
              <div className="pipeline-columns">
                {[
                  ["Triagem", "76", "#3156d8"],
                  ["Entrevista", "52", "#6859d9"],
                  ["Avaliação", "28", "#9b70d8"],
                  ["Proposta", "14", "#e66f51"],
                ].map(([stage, total, color], index) => (
                  <div key={stage}>
                    <span style={{ background: color }} />
                    <small>{stage}</small><b>{total}</b>
                    {candidates[index] && <p><i>{candidates[index][2]}</i>{candidates[index][0]}<em>{candidates[index][1]}</em></p>}
                  </div>
                ))}
              </div>
            </article>
            <article className="activity-card">
              <header><b>Atividade recente</b></header>
              {[
                ["Nova candidatura recebida", "10 min", "blue"],
                ["Proposta aprovada pelo cliente", "1 h", "coral"],
                ["Entrevista agendada", "2 h", "violet"],
                ["Onboarding iniciado", "3 h", "green"],
              ].map(([text, time, color]) => <p key={text}><i className={color} /> <span>{text}</span><small>{time}</small></p>)}
            </article>
          </div>
          <div className="mock-bottom">
            <article><b>Conversão por etapa</b><div className="bars"><i /><i /><i /><i /><i /></div></article>
            <article><b>Candidatos por origem</b><div className="donut" /><small>LinkedIn&nbsp; 46%</small></article>
            <article><b>Próximas entrevistas</b><p><i>RA</i> Rafael Albuquerque <span>Hoje, 14:00</span></p><p><i>CM</i> Carla Mendes <span>Amanhã, 09:30</span></p></article>
          </div>
        </div>
      </div>
    </div>
  );
}

function ContactModal({ onClose }: { onClose: () => void }) {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError("");
    const form = new FormData(event.currentTarget);
    const query = new URLSearchParams(window.location.search);
    try {
      const response = await fetch("/api/leads", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        name: form.get("name"), email: form.get("email"), company: form.get("company"), company_size: form.get("company_size"), objective: form.get("objective"), website: form.get("website"),
        attribution: Object.fromEntries(["utm_source","utm_medium","utm_campaign","utm_content","utm_term","gclid"].map(key => [key,query.get(key) ?? ""]).filter(([,value]) => value)),
      }) });
      if (!response.ok) throw new Error("LEAD_REQUEST_FAILED");
      trackMarketingEvent("lead_submitted", "contact_modal");
      setSubmitted(true);
    } catch {
      setSubmitError("Não conseguimos registrar agora. Tente novamente em instantes.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="contact-modal" role="dialog" aria-modal="true" aria-labelledby="contact-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Fechar">×</button>
        {submitted ? (
          <div className="form-success">
            <span><Icon name="check" size={28} /></span>
            <p className="eyebrow">Tudo certo</p>
            <h2 id="contact-title">Seu interesse foi registrado.</h2>
            <p>Recebemos seus dados e sua empresa já entrou na fila de contato comercial.</p>
            <a className="button primary" href="/demo">Explorar o produto <Icon name="arrow" /></a>
          </div>
        ) : (
          <>
            <p className="eyebrow">Pare de operar no escuro</p>
            <h2 id="contact-title">Descubra quanto sua operação perde com sistemas desconectados.</h2>
            <p>Em uma conversa objetiva, mostramos o fluxo ideal para o seu cenário e o que pode ser centralizado primeiro.</p>
            <form onSubmit={submit}>
              <input className="form-honeypot" tabIndex={-1} autoComplete="off" name="website" aria-hidden="true" />
              <label>Nome completo<input required name="name" placeholder="Como podemos chamar você?" /></label>
              <label>E-mail corporativo<input required type="email" name="email" placeholder="voce@empresa.com.br" /></label>
              <div className="form-row">
                <label>Empresa<input required name="company" placeholder="Nome da empresa" /></label>
                <label>Tamanho<select name="company_size" required defaultValue=""><option value="" disabled>Colaboradores</option><option>Até 50</option><option>51 a 200</option><option>201 a 500</option><option>Mais de 500</option></select></label>
              </div>
              <label>Principal objetivo<select name="objective" required defaultValue=""><option value="" disabled>Selecione uma opção</option><option>Organizar CRM e clientes</option><option>Melhorar recrutamento e seleção</option><option>Centralizar RH e dados de pessoas</option><option>Gerir desempenho, clima e eNPS</option><option>Substituir várias ferramentas</option></select></label>
              {submitError && <small className="form-submit-error">{submitError}</small>}
              <button className="button primary wide" type="submit" disabled={submitting}>{submitting ? "Enviando..." : <>Quero meu diagnóstico <Icon name="arrow" /></>}</button>
              <small>Ao enviar, você concorda em receber contato sobre o Prismae.</small>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [teamHours, setTeamHours] = useState(80);
  const [softwareSpend, setSoftwareSpend] = useState(2500);
  const recoveredHours = Math.round(teamHours * 4.33 * .2);
  const estimatedImpact = Math.round(recoveredHours * 45 + softwareSpend * .3);

  return (
    <main className="marketing-page">
      <header className="site-header">
        <a href="#inicio" aria-label="Prismae - início"><Brand /></a>
        <button className="menu-toggle" aria-expanded={menuOpen} aria-label="Abrir menu" onClick={() => setMenuOpen(!menuOpen)}><span /><span /><span /></button>
        <nav className={menuOpen ? "open" : ""}>
          <a href="#produto" onClick={() => setMenuOpen(false)}>Produto</a>
          <a href="#solucoes" onClick={() => setMenuOpen(false)}>Soluções</a>
          <a href="#diferenciais" onClick={() => setMenuOpen(false)}>Diferenciais</a>
          <a href="#precos" onClick={() => setMenuOpen(false)}>Preços</a>
          <a href="#seguranca" onClick={() => setMenuOpen(false)}>Segurança</a>
        </nav>
        <div className="header-actions">
          <a href="/auth/login" className="login-link">Entrar</a>
          <button className="button primary small" onClick={() => { trackMarketingEvent("open_lead_form","header"); setContactOpen(true); }}>Calcular meu cenário</button>
        </div>
      </header>

      <section className="hero" id="inicio">
        <div className="orbit-art" aria-hidden="true"><i /><i /><i /><span /><span /><span /></div>
        <div className="hero-copy">
          <p className="eyebrow"><span /> PARE DE PAGAR PELO CAOS OPERACIONAL</p>
          <h1>Seu RH perde dinheiro toda vez que uma informação <em>morre entre dois sistemas.</em></h1>
          <p className="hero-lead">O Prismae conecta CRM, recrutamento, pessoas, desempenho e clima em uma única operação. Menos retrabalho. Mais controle. Nenhum dado recomeçando do zero.</p>
          <div className="hero-actions">
            <a className="button primary" href="/auth/signup?plan=pro" onClick={event => startAttributedTrial(event,"pro","hero")}>Testar grátis por 14 dias <Icon name="arrow" /></a>
            <a className="button secondary" href="/demo" onClick={() => trackMarketingEvent("view_demo","hero")}><Icon name="play" /> Ver o produto por dentro</a>
          </div>
          <div className="hero-proof">
            <span><Icon name="check" size={16} /> Sem cartão para criar a conta</span>
            <span><Icon name="check" size={16} /> Dados isolados por empresa</span>
            <span><Icon name="check" size={16} /> Cancele quando quiser</span>
          </div>
        </div>
        <div className="hero-product"><DashboardMock /></div>
      </section>

      <section className="proof-strip" aria-label="Principais benefícios">
        <p>O custo de continuar fragmentado cresce todos os meses</p>
        <div><strong>1</strong><span>cadastro do candidato<br />até virar colaborador</span></div>
        <div><strong>360°</strong><span>visão de clientes,<br />vagas e pessoas</span></div>
        <div><strong>3</strong><span>portais conectados:<br />empresa, cliente e talento</span></div>
        <div><strong>100%</strong><span>das ações críticas<br />com trilha de auditoria</span></div>
      </section>

      <section className="problem-section section" id="produto">
        <div className="section-heading centered">
          <p className="eyebrow">O problema que ninguém resolveu por inteiro</p>
          <h2>Planilhas não são flexibilidade. São uma dívida operacional escondida.</h2>
          <p>O CRM para no contrato, o ATS para na contratação e o software de RH começa tudo de novo. Sua equipe paga a conta copiando dados, cobrando prazos e montando relatórios que já nascem atrasados.</p>
        </div>
        <div className="fragmented-flow">
          {[
            ["CRM genérico", "Cliente, proposta e contrato", "Dados comerciais isolados"],
            ["ATS separado", "Vaga, currículo e entrevista", "Candidato some após a admissão"],
            ["RH operacional", "Cadastro, documento e férias", "Sem origem nem histórico da contratação"],
            ["Planilhas", "Indicadores e controles paralelos", "Retrabalho, erro e nenhuma auditoria"],
          ].map(([title, description, pain], index) => (
            <article key={title}>
              <span>0{index + 1}</span><h3>{title}</h3><p>{description}</p><small>{pain}</small>
            </article>
          ))}
        </div>
        <div className="unified-answer"><Brand compact /><span>Uma identidade. Uma linha do tempo. Uma fonte confiável.</span><Icon name="sparkles" size={24} /></div>
      </section>

      <section className="before-after-section section">
        <div className="section-heading split-heading"><div><p className="eyebrow">A decisão que muda a operação</p><h2>Continue administrando ferramentas. Ou comece a administrar resultados.</h2></div><p>O Prismae elimina as passagens manuais entre comercial, recrutamento e RH. Cada contratação preserva contexto, responsabilidade e histórico.</p></div>
        <div className="before-after-grid"><article className="before-card"><span>HOJE, FRAGMENTADO</span><h3>O processo trabalha contra o time.</h3><ul><li>O mesmo dado digitado mais de uma vez</li><li>Prazo cobrado por mensagem e memória</li><li>Relatório montado depois que a decisão passou</li><li>Candidato contratado desaparece do histórico</li><li>Feedback coletado sem plano de ação</li></ul></article><article className="after-card"><span>COM PRISMAE</span><h3>O sistema carrega o contexto.</h3><ul><li>Uma identidade da candidatura ao colaborador</li><li>Agenda, responsáveis e prazos visíveis</li><li>Indicadores calculados na mesma base</li><li>Metas, avaliações, eNPS e ações conectados</li><li>Permissões e auditoria por empresa</li></ul><a href="/auth/signup?plan=pro" onClick={event => startAttributedTrial(event,"pro","before_after")}>Começar a transformação <Icon name="arrow" size={17} /></a></article></div>
      </section>

      <section className="solutions-section section" id="solucoes">
        <div className="section-heading split-heading">
          <div><p className="eyebrow">Tudo conectado</p><h2>Completo onde precisa. Simples onde importa.</h2></div>
          <p>Você ativa apenas os módulos necessários hoje. Quando a operação crescer, os dados e os processos já estarão prontos para acompanhar.</p>
        </div>
        <div className="feature-grid">
          {featureGroups.map((feature) => (
            <article key={feature.title}>
              <div className="feature-icon"><Icon name={feature.icon} size={24} /></div>
              <span>{feature.tag}</span>
              <h3>{feature.title}</h3>
              <p>{feature.text}</p>
              <ul>{feature.items.map((item) => <li key={item}><Icon name="check" size={16} />{item}</li>)}</ul>
            </article>
          ))}
        </div>
      </section>

      <section className="roi-section section" id="roi">
        <div className="roi-card"><div className="roi-copy"><p className="eyebrow">Calculadora de desperdício operacional</p><h2>Quanto custa manter seu time copiando, conferindo e perseguindo informação?</h2><p>Monte um cenário rápido. A estimativa usa 20% das horas operacionais potencialmente recuperáveis e 30% de consolidação do gasto com ferramentas. É uma simulação, não uma promessa de resultado.</p><div className="roi-controls"><label><span>Horas semanais gastas em tarefas manuais <b>{teamHours}h</b></span><input type="range" min="10" max="400" step="10" value={teamHours} onChange={event => setTeamHours(Number(event.target.value))} /></label><label><span>Gasto mensal com softwares separados <b>R$ {softwareSpend.toLocaleString("pt-BR")}</b></span><input type="range" min="0" max="20000" step="250" value={softwareSpend} onChange={event => setSoftwareSpend(Number(event.target.value))} /></label></div></div><div className="roi-result"><small>IMPACTO MENSAL ESTIMADO</small><strong>R$ {estimatedImpact.toLocaleString("pt-BR")}</strong><span>em capacidade e consolidação</span><div><b>{recoveredHours}h</b><small>potencialmente recuperadas por mês</small></div><button className="button primary wide" onClick={() => { trackMarketingEvent("open_lead_form","roi_calculator"); setContactOpen(true); }}>Validar este cenário <Icon name="arrow" /></button><em>Estimativa ilustrativa baseada nos valores informados.</em></div></div>
      </section>

      <section className="journey-section section">
        <div className="section-heading centered inverse">
          <p className="eyebrow">Uma jornada contínua</p>
          <h2>Cada interação enriquece a próxima decisão.</h2>
          <p>O histórico começa no primeiro contato comercial e continua durante toda a relação com o cliente, o candidato e o colaborador.</p>
        </div>
        <div className="journey-track">
          {[
            ["01", "Prospectar", "Lead, empresa e oportunidade"],
            ["02", "Vender", "Proposta, contrato e SLA"],
            ["03", "Recrutar", "Vaga, triagem e entrevistas"],
            ["04", "Contratar", "Oferta, documentos e admissão"],
            ["05", "Desenvolver", "Metas, PDI, clima e retenção"],
          ].map(([number, title, text]) => <article key={title}><span>{number}</span><h3>{title}</h3><p>{text}</p></article>)}
        </div>
        <div className="journey-dashboard">
          <div className="journey-chart"><span>Receita recorrente por cliente</span><strong>R$ 184,2 mil</strong><em>↗ 18,4% no trimestre</em><svg viewBox="0 0 560 130" preserveAspectRatio="none"><defs><linearGradient id="area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#7486ff" stopOpacity=".38"/><stop offset="1" stopColor="#7486ff" stopOpacity="0"/></linearGradient></defs><path className="area" d="M0 118 C60 92,80 108,130 70 S220 94,270 55 S360 78,410 32 S500 50,560 12 L560 130 L0 130Z"/><path d="M0 118 C60 92,80 108,130 70 S220 94,270 55 S360 78,410 32 S500 50,560 12"/></svg></div>
          <div className="journey-insight"><span><Icon name="sparkles" /></span><small>Leitura conectada</small><strong>Compare a origem da contratação, o onboarding, o desempenho e o clima sem remontar a história em planilhas.</strong><a href="/demo">Abrir demonstração <Icon name="arrow" size={16} /></a></div>
        </div>
      </section>

      <section className="ai-section section" id="diferenciais">
        <div className="ai-copy">
          <p className="eyebrow">Prismae Analytics</p>
          <h2>O dado só tem valor quando alguém consegue agir antes que seja tarde.</h2>
          <p>Os indicadores nascem dos processos reais, respeitam o acesso de cada função e nunca misturam informações entre empresas.</p>
          <ul>
            <li><Icon name="check" />Enxergue gargalos do funil de recrutamento.</li>
            <li><Icon name="check" />Acompanhe prazos e atividades atrasadas.</li>
            <li><Icon name="check" />Cruze metas, avaliações, eNPS e planos de ação.</li>
            <li><Icon name="check" />Mantenha cada alteração crítica em auditoria.</li>
          </ul>
          <a className="text-link" href="/demo">Ver os relatórios no painel <Icon name="arrow" /></a>
        </div>
        <div className="ai-panel">
          <div className="ai-panel-top"><span><Icon name="chart" size={18} /></span><b>Resumo executivo</b><small>Cenário ilustrativo</small></div>
          <div className="ai-question"><small>FILTRO ATUAL</small><p>Quais processos exigem atenção da liderança nesta semana?</p></div>
          <div className="ai-answer"><span><Icon name="chart" size={16} /></span><div><small>Leitura operacional</small><p>O painel concentra os sinais que pedem decisão:</p><ul><li><b>Recrutamento</b> — vagas e candidaturas paradas por etapa.</li><li><b>Pessoas</b> — jornadas, documentos e atividades pendentes.</li><li><b>Desempenho</b> — metas em risco e avaliações abertas.</li><li><b>Clima</b> — participação, eNPS e planos atrasados.</li></ul><div className="source-chips"><span>CRM</span><span>ATS</span><span>Pessoas</span><span>Clima</span></div></div></div>
          <div className="ai-input">Dados do ambiente, respeitando seu perfil de acesso <button aria-label="Abrir"><Icon name="arrow" size={16} /></button></div>
        </div>
      </section>

      <section className="security-section section" id="seguranca">
        <div className="security-card">
          <div className="security-copy"><p className="eyebrow">Segurança desde a arquitetura</p><h2>Dados de pessoas exigem mais do que uma senha forte.</h2><p>O Prismae nasce multiempresa, com isolamento de dados, permissões granulares e registros de auditoria. Cada ação sensível deixa rastro e cada usuário vê apenas o necessário.</p><button className="button light" onClick={() => setContactOpen(true)}>Conversar sobre segurança <Icon name="arrow" /></button></div>
          <div className="security-grid">
            {[
              ["shield", "Isolamento por empresa", "Toda consulta e operação é vinculada ao tenant correto."],
              ["lock", "Acesso por função", "Perfis, equipes e campos sensíveis com permissões próprias."],
              ["document", "LGPD operacional", "Consentimento, retenção, exportação e anonimização de dados."],
              ["chart", "Auditoria completa", "Histórico de acessos, alterações, exportações e automações."],
            ].map(([icon, title, text]) => <article key={title}><span><Icon name={icon as IconName} /></span><div><h3>{title}</h3><p>{text}</p></div></article>)}
          </div>
        </div>
      </section>

      <section className="pricing-section section" id="precos">
        <div className="section-heading centered">
          <p className="eyebrow">Planos que acompanham o crescimento</p>
          <h2>Comece com o essencial. Evolua sem trocar de sistema.</h2>
          <p>Escolha um plano, teste com seus próprios processos por 14 dias e decida com evidência — não com promessa comercial.</p>
        </div>
        <div className="pricing-grid">
          {plans.map((plan) => (
            <article key={plan.id} className={plan.popular ? "popular" : ""}>
              {plan.popular && <div className="popular-label">Mais escolhido</div>}
              <h3>{plan.name}</h3><p>{plan.description}</p>
              {plan.custom ? <div className="price custom-price"><strong>Sob consulta</strong><small>projeto e volume personalizados</small></div> : <div className="price"><small>R$</small><strong>{plan.monthly}</strong><span>/mês</span><em>cobrança mensal</em></div>}
              {plan.custom ? (
                <button className="button wide secondary" onClick={() => setContactOpen(true)}>Falar com especialista <Icon name="arrow" /></button>
              ) : (
                <a className={`button wide ${plan.popular ? "primary" : "secondary"}`} href={`/auth/signup?plan=${plan.id}`} onClick={event => startAttributedTrial(event,plan.id,`pricing_${plan.id}`)}>Testar {plan.name} por 14 dias <Icon name="arrow" /></a>
              )}
              <ul>{plan.features.map((feature) => <li key={feature}><span><Icon name="check" size={15} /></span>{feature}</li>)}</ul>
            </article>
          ))}
        </div>
        <p className="pricing-note">Criação de conta sem cartão. Todos os planos incluem ambiente multiempresa seguro, suporte em português, atualizações e backup. Integrações de terceiros podem ter cobrança própria.</p>
      </section>

      <section className="faq-section section">
        <div className="section-heading split-heading"><div><p className="eyebrow">Perguntas frequentes</p><h2>Antes de tomar a decisão.</h2></div><p>Se a sua operação tem uma necessidade específica, o plano Custom permite adaptar integrações, limites, identidade e implantação.</p></div>
        <div className="faq-list">
          {[
            ["O Prismae serve para RH interno e para consultorias?", "Sim. A empresa pode usar a gestão de pessoas e o ATS interno; a consultoria ganha, além disso, CRM comercial, portal do cliente, SLAs, propostas e indicadores de receita."],
            ["Consigo migrar dados de planilhas ou de outro sistema?", "Sim. A implantação prevê importação assistida de colaboradores, candidatos, clientes e documentos, com validação antes da entrada em produção."],
            ["Como os planos são validados dentro do sistema?", "Cada assinatura gera direitos de acesso e limites de uso. O sistema valida esses direitos no servidor antes de liberar módulos, usuários, volumes e integrações, e atualiza o acesso a partir dos eventos de cobrança."],
            ["Posso usar minha marca e meu próprio domínio?", "No Custom, sim. É possível aplicar logotipo, cores, domínio, página de carreiras e portais com a identidade da empresa."],
            ["O sistema calcula folha e envia eSocial?", "A arquitetura prevê integrações e exportações para folha e eSocial. O cálculo trabalhista completo deve ser habilitado apenas com parceiro homologado e revisão jurídica/contábil."],
          ].map(([question, answer]) => <details key={question}><summary>{question}<span>+</span></summary><p>{answer}</p></details>)}
        </div>
      </section>

      <section className="final-cta">
        <div><p className="eyebrow">A troca custa menos do que continuar igual</p><h2>Cada mês sem uma fonte única é mais dado duplicado, mais prazo perdido e menos margem.</h2><p>Crie seu ambiente agora e coloque o Prismae para trabalhar com um processo real da sua empresa.</p><div><a className="button light" href="/auth/signup?plan=pro" onClick={event => startAttributedTrial(event,"pro","final_cta")}>Começar 14 dias grátis <Icon name="arrow" /></a><button className="button ghost-light" onClick={() => { trackMarketingEvent("open_lead_form","final_cta"); setContactOpen(true); }}>Quero um diagnóstico</button></div></div>
        <div className="cta-orbit" aria-hidden="true"><i /><i /><i /><span /></div>
      </section>

      <footer className="site-footer">
        <div><Brand /><p>CRM, ATS e Gestão de Pessoas em uma única plataforma.</p></div>
        <div><b>Produto</b><a href="#solucoes">Módulos</a><a href="/demo">Demonstração</a><a href="#precos">Planos</a><a href="#seguranca">Segurança</a></div>
        <div><b>Soluções</b><a href="#solucoes">Consultorias de RH</a><a href="#solucoes">RH interno</a><a href="#solucoes">Grandes empresas</a><a href="#solucoes">White label</a></div>
        <div><b>Empresa</b><button onClick={() => setContactOpen(true)}>Contato</button><a href="#inicio">Privacidade</a><a href="#inicio">Termos</a></div>
        <small>© 2026 Prismae People OS. Todos os direitos reservados.</small>
      </footer>

      <div className="floating-conversion"><div><strong>Seu processo não precisa esperar a próxima planilha quebrar.</strong><span>Crie uma conta e teste com dados reais por 14 dias.</span></div><a href="/auth/signup?plan=pro" onClick={event => startAttributedTrial(event,"pro","floating_cta")}>Começar grátis <Icon name="arrow" size={17} /></a></div>

      {contactOpen && <ContactModal onClose={() => setContactOpen(false)} />}
    </main>
  );
}
