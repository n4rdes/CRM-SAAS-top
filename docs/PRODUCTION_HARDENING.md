# Endurecimento de produção — migration 009

## O que foi implementado

- Webhooks Stripe são registrados antes do processamento por `claim_billing_webhook_event`.
- Idempotência e reivindicação são atômicas no PostgreSQL, com retry de eventos falhos ou travados.
- Eventos de assinatura carregam data e prioridade; eventos antigos não sobrescrevem o estado mais recente.
- A renderização do layout e da página de assinatura não consulta mais a Stripe.
- A sincronização manual permanece disponível como contingência administrativa.
- Leads, login, cadastro, recuperação de senha e pesquisas públicas usam rate limiting distribuído.
- URLs de autenticação usam exclusivamente `NEXT_PUBLIC_APP_URL`, sem confiar em Host/X-Forwarded-Host.
- Documentos têm escopo pessoal/empresa, retenção, validação de assinatura do arquivo, integração opcional com antivírus e log de download.
- Downloads privados passam por rota auditada; a leitura direta do bucket por usuários autenticados foi removida.
- Índices adicionais cobrem consultas frequentes de vagas, candidaturas, pessoas, ausências, notificações e automações.
- Node.js foi fixado na linha LTS 22.
- `/api/health` verifica a disponibilidade do banco com timeout e resposta sem cache.
- O painel possui estado de carregamento e recuperação de erro para não permanecer em uma tela aparentemente travada.
- O workflow manual `Prismae Staging Validation` executa segurança, migrations, isolamento RLS e smoke tests no ambiente protegido `staging`.

## Ordem segura de implantação

1. Criar um projeto Supabase separado para staging.
2. Configurar as variáveis de `.env.example` no ambiente de staging.
3. Executar `supabase db push` e confirmar a migration `202607230009_production_hardening.sql`.
4. Rodar `npm run test:integration:rls` com duas contas pertencentes a tenants diferentes.
5. Publicar a aplicação de staging.
6. Criar no GitHub o environment protegido `staging`, preencher seus secrets/variables e executar o workflow `Prismae Staging Validation`.
7. Rodar `npm run smoke` com `SMOKE_BASE_URL` apontando para staging; o primeiro teste será `/api/health`.
8. Reenviar no Stripe CLI eventos de assinatura repetidos e fora de ordem; confirmar a tabela `billing_webhook_events`.
9. Somente depois aplicar a migration no banco de produção e publicar a aplicação.

## Antivírus de documentos

A aplicação aceita um gateway privado de varredura por `DOCUMENT_SCANNER_URL`. O endpoint deve receber `multipart/form-data`, campo `file`, e responder JSON:

```json
{ "clean": true, "provider": "clamav", "reference": "scan-id-opcional" }
```

Em produção, defina `DOCUMENT_REQUIRE_MALWARE_SCAN=true`. Sem um scanner disponível, o upload será bloqueado em vez de armazenar conteúdo não verificado.

## Verificação de migrations

- `npm run verify:migrations` valida ordem, duplicidade e operações destrutivas locais.
- `VERIFY_REMOTE_MIGRATIONS=1 npm run verify:migrations` chama a Supabase CLI ligada ao projeto para comparar o histórico remoto.
- O CI executa a validação local em toda pull request.

## Recuperação

A migration é incremental. Em caso de falha na aplicação, reverta o deploy do código primeiro; as colunas e tabelas novas podem permanecer sem afetar as versões anteriores. Não remova a migration nem apague a caixa de webhooks durante uma recuperação.
