# Prismae People OS

Prismae é um SaaS B2B que conecta CRM para consultorias de RH, ATS, cadastro de colaboradores, desempenho, clima, automações, People Analytics e controle de assinatura.

Esta entrega contém uma operação completa e conectada:

- `/` — site comercial responsivo, planos Basic/Pro/Custom, FAQ, segurança e captação de demonstração;
- `/demo` — demonstração pública de alta fidelidade (os dados são fictícios);
- `/auth` — cadastro, login, confirmação de e-mail e recuperação de senha pelo Supabase;
- `/app` — dashboard configurável por usuário, CRM, ATS, Pessoas e atalhos operacionais;
- `/app/central` — caixa de entrada com notificações, aprovações, prazos e riscos;
- `/app/ausencias` — férias, licenças, políticas, saldos, aprovações e calendário de equipe;
- `/app/automacoes` — gatilhos de contratação, admissão e ausência com tarefas e notificações rastreáveis;
- `/app/clima` — pesquisas de clima e eNPS, resultados agregados, planos de ação e reconhecimento;
- `/app/relatorios` — painéis configuráveis, filtros por data e exportação CSV compatível com Excel e Google Sheets;
- `/pesquisa/[token]` — experiência pública e anônima de resposta, sem exigir login;
- `/onboarding` — criação segura do primeiro ambiente multiempresa e da assinatura de teste.

## Configurar o Supabase

1. No painel do Supabase, abra **SQL Editor > New query**.
2. Execute, nesta ordem, todo o conteúdo de:
   - `supabase/migrations/202607210001_foundation.sql` — estrutura, planos e RLS;
   - `supabase/migrations/202607210002_audit_triggers.sql` — histórico automático de alterações;
   - `supabase/migrations/202607210003_team_billing.sql` — equipe, permissões, leads e cobrança;
   - `supabase/migrations/202607210004_operations_analytics.sql` — contatos, agenda, avaliações e histórico do ATS;
   - `supabase/migrations/202607220005_people_core.sql` — Pessoas, estrutura organizacional, documentos e jornadas;
   - `supabase/migrations/202607220006_performance_growth.sql` — ciclos, metas, avaliações e check-ins 1:1;
   - `supabase/migrations/202607220007_engagement_climate.sql` — clima, eNPS, escuta anônima, reconhecimento e planos de ação;
   - `supabase/migrations/202607220008_timeoff_automations.sql` — ausências, saldos, notificações, automações e preferências dos painéis.
3. Em **Authentication > URL Configuration**, use `http://localhost:3000` como Site URL e adicione `http://localhost:3000/**` em Redirect URLs.
4. Copie `.env.example` para `.env.local` e preencha a API URL e a Publishable key. Para leads e cobrança, configure também a Secret key do Supabase e as variáveis do Stripe. Nunca coloque chaves secretas em variável `NEXT_PUBLIC_*`.

No PowerShell do Windows:

```powershell
Copy-Item .env.example .env.local
notepad .env.local
```

## Executar localmente

Use Node.js 20.9 ou superior. Se o PowerShell bloquear `npm.ps1`, use `npm.cmd`:

```powershell
npm.cmd install
npm.cmd run dev
```

Abra `http://localhost:3000`. Para validar a entrega completa (testes de domínio, tipos, lint e build):

```powershell
npm.cmd run check
```

## Estrutura principal

- `app/page.tsx` e `app/globals.css`: aquisição e conversão;
- `app/demo/page.tsx` e `app/demo/demo.css`: aplicação SaaS navegável;
- `app/auth`, `app/onboarding`, `app/convite` e `app/app`: autenticação, convites e aplicação real;
- `app/api/leads` e `app/api/stripe/webhook`: captação comercial e sincronização de cobrança;
- `lib/supabase`: clientes browser/servidor e renovação segura da sessão;
- `supabase/migrations`: schema, planos, assinatura, funções e políticas RLS;
- `lib/subscriptions.ts`: catálogo de planos e decisão de entitlement;
- `docs/PRODUCT_STRATEGY.md`: pesquisa, posicionamento, módulos e roadmap;
- `docs/PRODUCTION_ARCHITECTURE.md`: arquitetura multi-tenant, cobrança, segurança e LGPD.

## Estado da entrega

Login, banco multiempresa, RLS, onboarding, assinatura de teste, CRM com contatos, banco de candidatos, ATS, histórico de etapas, agenda, Central de trabalho, Pessoas, departamentos, cargos, documentos privados, onboarding/offboarding, férias e ausências, políticas e saldos, ciclos de desempenho, OKRs, avaliações, check-ins 1:1, pesquisas de clima e eNPS, escuta anônima, planos de ação, reconhecimento, automações rastreáveis, dashboards configuráveis, relatórios filtráveis e exportação para planilhas estão implementados. A aplicação converte candidatos contratados em colaboradores sem duplicação, valida limites por plano, registra auditoria, capta leads do site e possui checkout, portal de cobrança e webhooks do Stripe prontos para configuração. A demonstração pública replica a navegação e a identidade visual do produto real com dados fictícios.

E-mail transacional, disparo automatizado das pesquisas, controle de ponto, domínio, hospedagem e revisão dos documentos jurídicos ainda fazem parte das próximas fases antes do lançamento comercial.
