# Prismae People OS

Prismae é um SaaS B2B que conecta CRM para consultorias de RH, ATS, cadastro de colaboradores, desempenho, clima, automações, People Analytics e controle de assinatura.

Esta entrega contém quatro experiências:

- `/` — site comercial responsivo, planos Basic/Pro/Custom, FAQ, segurança e captação de demonstração;
- `/demo` — demonstração pública de alta fidelidade (os dados são fictícios);
- `/auth` — cadastro, login, confirmação de e-mail e recuperação de senha pelo Supabase;
- `/app` — aplicação protegida com dashboard, clientes, vagas e candidatos persistidos no banco;
- `/onboarding` — criação segura do primeiro ambiente multiempresa e da assinatura de teste.

## Configurar o Supabase

1. No painel do Supabase, abra **SQL Editor > New query**.
2. Execute, nesta ordem, todo o conteúdo de:
   - `supabase/migrations/202607210001_foundation.sql` — estrutura, planos e RLS;
   - `supabase/migrations/202607210002_audit_triggers.sql` — histórico automático de alterações;
   - `supabase/migrations/202607210003_team_billing.sql` — equipe, permissões, leads e cobrança.
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

Abra `http://localhost:3000`. Para validar a entrega:

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
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

Login, banco multiempresa, RLS, onboarding, assinatura de teste, CRM, banco de candidatos, ATS, equipe, papéis de acesso, convites e configurações estão implementados. A aplicação valida limites de usuários e vagas por plano, registra auditoria, capta leads do site e possui checkout, portal do cliente e webhooks do Stripe prontos para configuração. A demonstração continua separada da aplicação real.

E-mail transacional, módulos avançados de pessoas, domínio, hospedagem e revisão dos documentos jurídicos ainda fazem parte das próximas fases antes do lançamento comercial.
