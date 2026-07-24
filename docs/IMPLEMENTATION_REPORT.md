# Relatório de implementação — endurecimento de produção

Data: 23/07/2026

## Escopo executado

Esta atualização altera o código do Prismae People OS; não é apenas um plano ou prompt. As correções foram implementadas sobre a pasta recebida, preservando as funcionalidades e alterações que já existiam no projeto.

### Cobrança e Stripe

- Caixa transacional para eventos Stripe no PostgreSQL.
- Reivindicação atômica, idempotência, tentativas e recuperação de eventos travados.
- Eventos simultâneos em processamento retornam erro temporário para impedir falso sucesso.
- Ordenação por data, prioridade e identificador do evento.
- Eventos antigos não sobrescrevem uma assinatura mais recente.
- Reconciliação externa removida do layout e das renderizações autenticadas.
- Sincronização manual mantida como contingência administrativa.
- Limite de 1 MB no corpo do webhook e validação da assinatura Stripe.

### Segurança e abuso

- Rate limiting distribuído no Supabase para leads, login, cadastro, recuperação de senha e pesquisa pública.
- Chaves de limite armazenadas como HMAC; IP e e-mail não são gravados em texto puro.
- Cabeçalhos de proxy só são aceitos quando a plataforma é reconhecida ou `TRUST_PROXY=true` foi configurado conscientemente.
- Limites reais de corpo, inclusive quando `Content-Length` está ausente.
- URLs de callback baseadas exclusivamente em `NEXT_PUBLIC_APP_URL`.
- Redirecionamentos internos validados contra open redirect.
- Headers de segurança, HSTS em produção, compressão e remoção de `X-Powered-By`.

### Documentos de colaboradores

- Separação entre documentos pessoais e documentos da empresa.
- Validação do conteúdo real de PDF, JPEG, PNG e DOCX.
- Limite de 8 MB.
- Integração com gateway antivírus e modo obrigatório em produção.
- Retenção configurável e metadados de varredura.
- Download por URL assinada de 60 segundos.
- Registro de upload, download e exclusão.
- Contagem e data do último download.
- Leitura direta do bucket removida; o acesso passa pela rota auditada.
- Documentos antigos sem varredura podem ser bloqueados quando o antivírus obrigatório estiver ativo.

### Isolamento e banco

- Migration incremental `202607230009_production_hardening.sql`.
- Teste de integração opcional com dois tenants para validar RLS e isolamento.
- Validador de ordem, duplicidade e operações destrutivas de migrations.
- Comparação opcional do histórico remoto pela Supabase CLI.
- Índices adicionais para assinaturas, vagas, candidatos, candidaturas, pessoas, documentos, clima, ausências, notificações e automações.

### Desempenho, estabilidade e operação

- Deduplicação por request das consultas de usuário, membership e tenant com `cache()`.
- Remoção de chamadas Stripe em navegação autenticada.
- Remoção da geração em lote de URLs assinadas durante a renderização da página de colaborador.
- Estado de carregamento no painel e tela de recuperação para erros de renderização.
- Endpoint `/api/health` com teste de banco, timeout e resposta sem cache.
- Smoke tests incluindo health check.
- Workflow de CI para segurança, migrations, testes, tipos, lint e build.
- Workflow manual protegido para validação de staging.
- Node.js fixado na linha 22 e lockfile validado com npm 10.9.2.

## Validações concluídas neste ambiente

- TypeScript: aprovado (`tsc --noEmit`).
- ESLint: aprovado.
- Verificação estática de segurança: aprovada.
- Validação das nove migrations: aprovada.
- Consistência do `package-lock.json`: aprovada em modo offline.
- Auditoria registrada pelo npm a partir do lockfile: zero vulnerabilidades conhecidas no conjunto resolvido.

## Validações que dependem do ambiente externo

O build completo, os testes Vitest e os testes RLS precisam ser executados após `npm ci` em Windows/CI Linux. O ZIP original trazia `node_modules` instalado para Windows; os binários Linux opcionais de Rollup/Next não estavam presentes, e o registry disponível no ambiente de análise retornou indisponibilidade ao tentar baixá-los.

A migration não foi aplicada a nenhum projeto Supabase remoto, e nenhum webhook Stripe real foi disparado. Essas ações exigem as credenciais e o ambiente de staging do proprietário.

## Implantação obrigatória

1. Criar/configurar o Supabase de staging.
2. Copiar `.env.staging.example` para o gerenciador de variáveis da hospedagem.
3. Executar as nove migrations, em ordem.
4. Rodar `npm ci` e `npm run check`.
5. Configurar e testar o scanner de documentos.
6. Executar os testes RLS com dois tenants de staging.
7. Publicar staging e executar `npm run smoke`.
8. Testar eventos Stripe duplicados e fora de ordem.
9. Só então aplicar a migration 009 e publicar em produção.
