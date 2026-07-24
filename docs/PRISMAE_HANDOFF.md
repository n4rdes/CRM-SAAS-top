# Handoff técnico — Prismae People OS

Atualizado para a transição do desenvolvimento do ChatGPT para o Codex em 22/07/2026.

## 1. Visão do produto

O Prismae People OS é um SaaS multi-tenant para empresas, RHs e consultorias. A tese é unir, em um único sistema:

- CRM B2B para prospecção e gestão de clientes;
- ATS para vagas, candidatos, candidaturas e etapas;
- agenda e atividades operacionais;
- gestão de pessoas e jornadas;
- desempenho, OKRs/metas e avaliações;
- dashboards e relatórios configuráveis;
- exportação de dados;
- gestão de equipe, convites e papéis;
- assinatura recorrente e controle de acesso por plano.

Marca atual: **Prismae** / **Prismae People OS**.

Público inicial: consultorias de RH, recrutamento e seleção, departamentos de RH e empresas brasileiras. O plano Custom é voltado a operações maiores.

## 2. Infraestrutura conhecida

- Código: `https://github.com/n4rdes/CRM-SAAS-top`
- Checkout local do usuário: `C:\Projetos\prismae-launch`
- Frontend/backend web: Next.js App Router + TypeScript.
- Banco/autenticação: Supabase/PostgreSQL/Auth/RLS.
- Pagamentos: Stripe Billing/Checkout/Customer Portal/webhooks.
- Ambiente principal de desenvolvimento: Windows + VS Code + PowerShell.
- A aplicação ainda estava em preparação para publicação com domínio e vendas; confirmar se já houve deploy posterior.

## 3. Funcionalidades construídas e testadas manualmente

O usuário informou que conseguiu:

- criar conta e autenticar;
- passar pelo onboarding;
- cadastrar empresa/cliente;
- cadastrar candidato;
- cadastrar vaga;
- acessar e usar as áreas principais do app;
- concluir Checkout Stripe em modo de teste;
- receber webhooks Stripe com resposta HTTP 200;
- abrir Customer Portal;
- mudar assinatura de Basic para Pro pelo portal;
- ver o plano atualizado na tela de assinatura;
- usar as atualizações de operações, pessoas, desempenho e UI sem erros aparentes após os ajustes.

Confirme cada fluxo no código e execute um smoke test antes de publicação.

## 4. Módulos conhecidos

### Site comercial

- Landing page com proposta de valor, benefícios, demonstração do produto, planos e CTAs.
- Copy foi reforçada para conversão.
- Planos exibidos: Basic, Pro e Custom.
- O CTA de exploração direciona à experiência do produto/demonstração.
- A captura visual e a demo devem permanecer coerentes com o app real.

### Autenticação e onboarding

- Login.
- Cadastro.
- Confirmação/check-email.
- Callback de autenticação.
- Esqueci a senha e atualização de senha.
- Onboarding para criação/entrada no ambiente da empresa.
- Convites por token.

### CRM e ATS

- Clientes/empresas e detalhes.
- Contatos de CRM vinculados a empresas.
- Vagas e detalhes.
- Candidatos e detalhes.
- Candidaturas e pipeline por estágio.
- Avaliações de candidaturas.
- Histórico de movimentação de estágio.
- Atividades, notas, ligações, reuniões, entrevistas e follow-ups.

### Operações e analytics

- Visão geral/dashboard.
- Central de trabalho/operação, conforme a versão atual do código.
- Agenda.
- Indicadores de recrutamento e operação.
- Relatórios com filtros, incluindo período/data.
- Seleção de cards/indicadores visíveis no dashboard e relatórios.
- Exportação de relatórios para planilhas/arquivo tabular; validar o formato implementado.

### Gestão de pessoas

- Lista de pessoas/colaboradores.
- Página de detalhes da pessoa.
- Jornadas/dados do colaborador.
- Férias e ausências, conforme migrations e rotas atuais.

### Desempenho

- Ciclos de avaliação.
- Metas/OKRs.
- Avaliações e acompanhamento.
- O formulário de nova meta tinha sobreposição ao rolar; isso foi corrigido na renovação de UI. Trate como teste de regressão.

### Equipe e administração

- Gestão de equipe.
- Convites.
- Configurações.
- Papéis/permissões do tenant.
- Auditoria de alterações, conforme migrations.

### Billing

- Página de assinatura.
- Checkout recorrente.
- Webhook Stripe.
- Customer Portal.
- Troca e cancelamento de plano.
- Sincronização do plano exibido no app.
- Basic: R$ 297/mês em teste.
- Pro: R$ 697/mês em teste.
- Custom: contato/negociação para empresas maiores.

## 5. Rotas observadas durante os builds

Esta lista veio de builds anteriores e deve ser comparada com a árvore atual de `app/`:

```text
/
/demo
/app
/app/agenda
/app/assinatura
/app/candidatos
/app/candidatos/[id]
/app/clientes
/app/clientes/[id]
/app/configuracoes
/app/equipe
/app/pessoas
/app/pessoas/[id]
/app/relatorios
/app/vagas
/app/vagas/[id]
/auth/callback
/auth/check-email
/auth/forgot-password
/auth/login
/auth/signup
/auth/update-password
/convite/[token]
/onboarding
/api/leads
/api/stripe/webhook
```

As atualizações posteriores podem ter adicionado rotas como desempenho, férias/ausências ou central de trabalho. O Codex deve enumerar `app/**/page.tsx` e `app/**/route.ts` para produzir a lista verdadeira.

## 6. Histórico técnico relevante

Marcos e commits observados ao longo do desenvolvimento:

- `8f8ccb1` — versão inicial do Prismae People OS.
- `9ef2c06` — fundação Supabase em branch inicial.
- `434f445` — merge das operações/analytics.
- `432a80f` — correção da chave composta de candidaturas.
- `0620d41` — módulo Pessoas e jornadas.
- `29f2732` — desempenho, OKRs e avaliações.
- `4ceb112` — merge da renovação de UI.
- `e237fc1` — renovação de interface e identidade visual.
- `86ce418` — atualização Ultra Suite operacional, segundo o histórico da conversa.
- `a89347c` — correção de demo, billing e menu retrátil.
- `4864759` — sincronização do plano no topo e ajuste do recolhimento.

Importante: os dois últimos commits podem estar em branch/PR e não na `main`. Confirme com `git branch -a`, `git log --all --decorate` e o estado dos PRs antes de concluir que estão publicados.

## 7. Migrations conhecidas

Foram observadas pelo menos:

```text
supabase/migrations/202607210001_foundation.sql
supabase/migrations/202607210002_audit_triggers.sql
supabase/migrations/202607210003_team_billing.sql
supabase/migrations/202607210004_operations_analytics.sql
```

Atualizações de Pessoas, Desempenho e Ultra Suite podem conter migrations posteriores. Enumere a pasta para obter a ordem completa.

A migration operacional inclui conceitos como:

- `crm_contacts`;
- `activities`;
- `application_reviews`;
- `application_stage_history`;
- triggers de `updated_at`;
- proteção contra alteração de `tenant_id`;
- auditoria;
- RLS e policies;
- histórico automático das mudanças de estágio.

Houve erro PostgreSQL `42830` porque uma FK referenciava `(tenant_id, id)` em `applications` sem constraint única correspondente. A solução foi adicionar `unique (tenant_id, id)` antes das tabelas dependentes. A query corrigida foi executada com sucesso.

## 8. Stripe — estado conhecido

- Conta criada e usada em modo de teste/área restrita.
- Produtos Basic e Pro criados.
- IDs de preço e chaves foram colocados em `.env.local` pelo usuário.
- Stripe CLI foi instalada; no PowerShell foi necessário contornar bloqueio de `.ps1`, normalmente chamando o executável `.cmd`.
- Login da Stripe CLI realizado.
- Encaminhamento local de webhook foi executado.
- Checkout com cartão de teste funcionou.
- Logs mostraram múltiplos `POST /api/stripe/webhook 200`.
- Customer Portal foi configurado para permitir alteração entre Basic e Pro.
- O portal inicialmente mostrava apenas cancelamento, depois passou a permitir troca de plano após salvar a configuração.
- A página de assinatura refletiu Pro, mas o badge do topo continuava Basic; uma correção posterior tornou o badge dinâmico.

Antes de produção, ainda é necessário confirmar:

- conta Stripe ativada para produção e dados empresariais aprovados;
- produtos/preços equivalentes no modo live;
- chaves live configuradas somente no provedor de hospedagem;
- endpoint público do webhook live;
- eventos necessários selecionados;
- idempotência e tratamento de eventos fora de ordem;
- impostos, nota fiscal e obrigações brasileiras;
- termos, política de privacidade e política de cancelamento.

## 9. UI e regressões já encontradas

- Sidebar inicialmente não rolava; passou a rolar sem scrollbar visível.
- Sidebar foi tornada retrátil, mantendo ícones funcionais quando recolhida.
- Botão de recolher ficou parcialmente cortado e recebeu ajuste de posição.
- Demo ficou visualmente diferente do app real; recebeu correção, mas deve permanecer em teste de regressão.
- Badge superior do plano ficou desatualizado após upgrade; recebeu correção.
- Formulário de nova meta ficava fixo e sobrepunha conteúdo; foi corrigido.
- Cards de assinatura tinham CSS ruim; foram redesenhados com destaque por hover/foco e Pro como padrão quando nenhum outro card está interagido.
- React alertou chaves duplicadas `Incluído` e `—`; isso foi corrigido. Não use conteúdo textual como chave se puder se repetir.
- Houve aviso de `scroll-behavior: smooth`; mantenha a solução recomendada pelo Next quando aplicável.
- Landing page já apresentou recompilação contínua, imagem piscando e panic do Turbopack. Verifique que não há gravação de arquivo durante renderização, loops de refresh ou dependências instáveis.

## 10. Ambiente Windows e problemas anteriores

- O PowerShell bloqueou `npm.ps1` e `stripe.ps1` por Execution Policy. Use `npm.cmd`/`npx.cmd`/executável `.cmd`.
- Um script antigo usava sintaxe Unix `WRANGLER_LOG_PATH=... vite`, incompatível com Windows. O fluxo atual passou a usar `next dev`; não restaure sintaxe Unix em scripts multiplataforma.
- O Smart App Control bloqueou `libcurl-4.dll` do Git.
- A pasta no OneDrive causou locks, inclusive mensagens repetidas de falha ao excluir `.git/objects/06` e arquivos durante troca de branch.
- O projeto foi movido para `C:\Projetos\prismae-launch`.
- Não use mais arquivos Git bundle como fluxo principal. O Codex deve trabalhar em branch, fazer push e abrir PR diretamente.

## 11. Qualidade conhecida

Um build anterior passou integralmente:

```text
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

O build Next gerou páginas estáticas e dinâmicas sem erro. Entretanto, depois de cada nova alteração, rode novamente os três comandos.

Um `npm audit` anterior informou 5 vulnerabilidades (1 baixa e 4 altas). Não execute `npm audit fix --force` automaticamente. Primeiro identifique dependências diretas/transitivas, impacto real e possibilidade de atualização sem quebra.

O npm também alertou scripts pendentes de `sharp` e `unrs-resolver`. Como o build chegou a passar, não aprove scripts cegamente; investigue somente se houver falha de instalação/build.

## 12. Arquivos sensíveis e resíduos que não devem ir ao Git

- `.env.local`;
- backups de `.env`;
- chaves ou segredos copiados em documentação/logs;
- `node_modules`;
- `.next`;
- logs do Wrangler/Next/Stripe;
- arquivos `*.bundle` usados nas atualizações antigas;
- panic logs do Turbopack;
- exports contendo dados reais de pessoas/candidatos.

Antes do commit, use `git status --short` e revise o staged diff.

## 13. Prioridades recomendadas para chegar à venda

### P0 — descobrir o estado real

- Confirmar branch atual, working tree, `origin/main`, PRs abertos e últimos commits.
- Confirmar se `a89347c` e `4864759` estão na `main`.
- Enumerar rotas, migrations e variáveis de `.env.example`.
- Rodar `typecheck`, `lint` e `build`.

### P1 — testes e segurança

- Criar testes automatizados para autenticação, isolamento de tenant e autorização por papel/plano.
- Testar checkout, webhooks idempotentes, upgrade, downgrade, cancelamento, falha de pagamento e reativação.
- Testar RLS tentando acessar dados de outro tenant.
- Testar os CRUDs e transições principais.
- Validar exportações e filtros por data.
- Fazer auditoria de dependências sem atualizações forçadas.

### P2 — produção

- Escolher hospedagem do Next.js e configurar variáveis seguras.
- Criar ambientes Supabase separados para desenvolvimento/staging/produção, se ainda não existirem.
- Automatizar aplicação controlada de migrations.
- Ativar Stripe live e webhook público.
- Configurar domínio, DNS, HTTPS e URLs de callback.
- Configurar e-mail transacional e templates.
- Adicionar monitoramento, logs estruturados, rastreamento de erros e alertas.
- Definir backup e teste de restauração do banco.

### P3 — operação comercial

- Analytics de aquisição e funil da landing page.
- Consentimento de cookies quando aplicável.
- Termos de uso, privacidade/LGPD, SLA e cancelamento.
- Fluxo de contato/demonstração para Custom.
- Processo de suporte e onboarding de clientes.
- Revisão de copy, SEO técnico, performance e acessibilidade.

## 14. Primeira tarefa do Codex

Antes de desenvolver a próxima feature, o Codex deve produzir um relatório curto com:

1. branch/commit atual e divergência em relação a `origin/main`;
2. arquivos modificados/não rastreados;
3. módulos e rotas existentes de verdade;
4. migrations existentes e ordem;
5. nomes das variáveis exigidas, sem mostrar valores;
6. estado de `typecheck`, `lint` e `build`;
7. inconsistências entre este handoff e o código;
8. riscos P0 que impedem produção;
9. recomendação da próxima atualização, sem implementá-la ainda.

Só depois desse diagnóstico deve começar uma nova grande atualização.
