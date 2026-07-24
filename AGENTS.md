# Prismae People OS — instruções permanentes para agentes

## Missão do produto

O Prismae People OS é um SaaS B2B brasileiro para empresas, departamentos de RH e consultorias. A proposta é reunir CRM comercial, ATS/recrutamento, gestão de pessoas, desempenho, agenda, relatórios e assinatura em uma única plataforma multiempresa.

O produto precisa ser vendável, seguro, intuitivo e consistente entre landing page, demonstração e aplicação autenticada. Não trate este repositório como protótipo descartável.

## Fonte de verdade e contexto inicial

- Repositório: `https://github.com/n4rdes/CRM-SAAS-top`
- Caminho local habitual no Windows: `C:\Projetos\prismae-launch`
- Leia antes de alterar: `README.md`, `docs/PRISMAE_HANDOFF.md`, `package.json`, `.env.example`, `proxy.ts`, `app/**`, `lib/**` e `supabase/migrations/**`.
- O nome antigo do pacote pode aparecer como `orbe-rh`; a marca pública atual é Prismae / Prismae People OS. Não renomeie mecanicamente sem analisar impactos.
- O estado real do Git e do código prevalece sobre este documento. Se houver divergência, informe-a antes de editar.

## Stack observada

- Next.js com App Router e TypeScript.
- React e Server Actions.
- Supabase: PostgreSQL, Auth e Row Level Security.
- Stripe: Checkout, Billing, webhooks e Customer Portal.
- CSS próprio do aplicativo e identidade visual Prismae.
- Desenvolvimento local em Windows, normalmente pelo terminal do VS Code/PowerShell.

Confirme versões e dependências em `package.json`; não presuma versões somente com base neste documento.

## Regras inegociáveis de segurança

- Nunca leia em voz alta, registre em logs, publique ou faça commit de valores de `.env.local`.
- Nunca exponha chaves secretas do Stripe, `SUPABASE_SERVICE_ROLE_KEY` ou segredo de webhook no cliente.
- Chaves públicas do Supabase podem ir ao navegador somente com RLS corretamente ativado.
- Toda consulta de negócio deve respeitar `tenant_id`; jamais enfraqueça isolamento multi-tenant para “fazer funcionar”.
- Autorizações de função e plano precisam ser validadas no servidor, não apenas escondidas na interface.
- Webhooks Stripe devem validar a assinatura e ser idempotentes.
- O sistema trata dados pessoais; preserve princípios de LGPD, minimização, auditoria e controle de acesso.
- Não execute comandos destrutivos como `git reset --hard`, `git clean -fd`, remoções recursivas ou reescrita de migrations sem autorização explícita.

## Banco de dados e migrations

- Migrations são parte do código e devem permanecer versionadas em `supabase/migrations`.
- O banco Supabase já recebeu migrations manualmente pelo SQL Editor durante o desenvolvimento.
- Não modifique uma migration que possa já ter sido aplicada. Para mudanças posteriores, crie uma nova migration incremental, idealmente idempotente.
- Antes de criar SQL, leia todas as migrations e confirme tabelas, constraints, funções, triggers, policies, grants e índices existentes.
- Preserve RLS em todas as tabelas de tenant.
- Houve anteriormente um erro de chave estrangeira composta em `applications`; a migration operacional foi corrigida adicionando unicidade compatível em `(tenant_id, id)`. Não reintroduza esse erro.
- Nunca aplique migrations em produção sem informar exatamente o arquivo, a ordem, o efeito e o plano de reversão/recuperação.

## Assinaturas e Stripe

- Planos comerciais: Basic, Pro e Custom/Enterprise.
- Valores de teste observados: Basic R$ 297/mês e Pro R$ 697/mês. Confirme no Stripe e no código antes de usar em produção.
- Basic e Pro usam assinatura recorrente; Custom é voltado a empresas maiores e pode exigir contato comercial.
- Checkout em modo de teste já foi validado manualmente.
- Webhook local já recebeu eventos com sucesso.
- Customer Portal já permite cancelamento e troca entre Basic e Pro.
- A aplicação deve sincronizar alterações feitas no portal e refletir o plano atual na página de assinatura, nas permissões e no topo do app.
- Nunca dependa do texto visual do plano como fonte de autorização.
- Não invente IDs de produtos/preços; leia os nomes das variáveis em `.env.example` e confirme a configuração.

## Experiência e identidade visual

- A landing page, `/demo` e o app real devem representar o mesmo produto e a mesma linguagem visual.
- Estilo desejado: limpo, moderno, profissional, claro e voltado à conversão B2B.
- Identidade observada: azul como cor principal, com acentos coral, roxo e verde usados com parcimônia; cartões claros, boa hierarquia, espaçamento consistente e tipografia forte.
- A barra lateral deve rolar com o mouse sem exibir scrollbar.
- A barra lateral é retrátil: aberta mostra ícones e rótulos; recolhida permanece funcional mostrando os ícones e tooltips/rótulos acessíveis.
- O controle de recolhimento não pode ficar cortado nem bloquear conteúdo.
- Não use formulários `sticky` que se sobreponham ao conteúdo durante a rolagem.
- Cards de planos: Pro é o destaque padrão apenas quando nenhum card está sob hover/foco; o card interagido deve receber o destaque visual.
- Preserve acessibilidade: foco visível, navegação por teclado, rótulos, contraste e comportamento responsivo.
- Evite dados/funções fictícias na aplicação autenticada. A demo pode usar dados fictícios, mas deve parecer e se comportar como o produto real.

## Fluxo de Git obrigatório

1. Antes de alterar, rode:
   - `git status --short`
   - `git branch --show-current`
   - `git log --oneline --decorate -12`
   - `git remote -v`
2. Se houver alterações do usuário, preserve-as e explique o impacto. Não descarte nada.
3. Sincronize a `main` somente quando o working tree estiver seguro.
4. Crie uma branch `agent/<descricao-curta>` a partir da `main` atualizada.
5. Faça mudanças coesas e revisáveis.
6. Não inclua `.env.local`, backups de `.env`, `node_modules`, arquivos `.bundle`, logs, `.next` ou segredos.
7. Rode as verificações proporcionais ao risco.
8. Mostre um resumo e o diff relevante.
9. Faça commit claro em português.
10. Faça push apenas da branch e abra Pull Request para `main`.
11. Nunca faça push direto para `main` nem merge sem pedido explícito. O usuário confirma o merge.

## Comandos no Windows

O PowerShell do usuário já bloqueou scripts `.ps1`. Prefira executáveis `.cmd`:

```powershell
npm.cmd install
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
npm.cmd run dev
```

- Não é necessário instalar dependências toda vez; rode `npm.cmd install` quando `node_modules` não existir ou quando `package.json`/`package-lock.json` mudar.
- Se o servidor estiver aberto e bloquear troca de branch ou arquivos, peça para interromper com `Ctrl+C` antes de operações Git.
- O repositório foi movido do OneDrive para `C:\Projetos\prismae-launch` devido a locks e falhas de exclusão dentro de `.git`.

## Definição de pronto

Uma atualização só está pronta quando:

- o requisito foi implementado no fluxo real, não apenas visualmente;
- estados de carregamento, vazio, sucesso e erro foram tratados;
- autenticação, tenant, função e plano foram validados no servidor;
- migrations e RLS foram revisadas quando houver dados novos;
- não houve regressão visual na landing, demo ou app;
- responsividade e navegação por teclado foram verificadas nas áreas alteradas;
- `typecheck`, `lint` e `build` passaram;
- testes automatizados relevantes passaram, ou a ausência deles foi informada;
- foi entregue um roteiro de teste manual curto;
- o diff foi revisado para segredos e arquivos acidentais;
- branch, commit, push e PR foram feitos conforme autorização.

## Postura esperada do Codex

- Antes do primeiro trabalho, faça um diagnóstico do repositório e compare o código com `docs/PRISMAE_HANDOFF.md`.
- Não afirme que algo existe apenas porque está descrito no handoff; valide no código e no banco aplicável.
- Para tarefas grandes, escreva um plano curto, implemente por etapas e teste antes de entregar.
- Corrija a causa raiz, não esconda erros com mocks ou tratamentos genéricos.
- Dê instruções ao usuário em português brasileiro, com passos numerados e comandos prontos para PowerShell.
- Se precisar de credenciais, diga apenas o nome da variável e onde configurá-la; nunca peça que o valor seja colado no chat.
