# Prismae Growth Engine — Data Foundation, ATS Profissional e Portal do Candidato

Esta atualização incremental parte do commit de production hardening e adiciona três camadas conectadas no mesmo produto.

## 1. Data Foundation

- Importação CSV auditável para candidatos, clientes, vagas e colaboradores.
- Pré-análise de até 3.000 linhas, validação por linha e confirmação posterior.
- Histórico de importações, totais importados e falhas detalhadas.
- Campos personalizados multi-tenant para candidatos, clientes, vagas e colaboradores.
- Tipos de campo: texto, texto longo, número, moeda, data, booleano, seleção, multiseleção, e-mail, telefone e URL.
- Pesquisa global com PostgreSQL `pg_trgm`, respeitando tenant e permissões.
- Detecção de candidatos duplicados por e-mail, telefone e similaridade de nome.
- Mesclagem auditada de candidatos e preservação de candidaturas, atividades, campos e dados do portal.
- Timeline unificada por entidade.
- Checklist de ativação para novos tenants.

## 2. ATS Profissional

- Página de carreiras por tenant, com identidade visual e vagas públicas.
- Configuração pública da vaga: local, modalidade, contrato, salário e formulário.
- Perguntas obrigatórias e eliminatórias.
- Candidatura pública protegida por honeypot, validação, limites de payload e rate limiting distribuído.
- Kits de entrevista e critérios estruturados.
- Horários de entrevista e autoagendamento pelo candidato.
- Propostas com salário, benefícios, início, validade e resposta auditável.
- Validação transacional da relação entre proposta, candidatura, candidato e tenant.

## 3. Portal do Candidato

- Link individual revogável e com expiração.
- Acompanhamento de candidaturas em linguagem adequada ao candidato.
- Mensagens entre candidato e equipe.
- Escolha de horários disponíveis.
- Visualização, aceite e recusa de proposta.
- Atualização de perfil e preferências.
- Banco de talentos e alertas de vagas.
- Upload e download temporário de documentos.
- Validação de tipo real, tamanho e integração opcional com scanner de malware.
- Solicitações LGPD de acesso, correção, portabilidade e exclusão.
- Rate limiting para perfil, mensagens, entrevistas, propostas, documentos e solicitações LGPD.
- Funções de escrita externas restritas ao `service_role`; o navegador não grava diretamente no banco.

## Migrations

Execute na ordem, depois da migration 009:

1. `202607240010_data_foundation.sql`
2. `202607240011_ats_professional.sql`
3. `202607240012_candidate_portal.sql`

## Variáveis necessárias

Preserve as variáveis do production hardening. São especialmente importantes:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
RATE_LIMIT_SECRET=segredo-longo-e-aleatorio
SUPABASE_SECRET_KEY=sb_secret_...
DOCUMENT_REQUIRE_MALWARE_SCAN=false
```

Em produção, configure scanner de malware antes de ativar `DOCUMENT_REQUIRE_MALWARE_SCAN=true`.

## Validações executadas na geração

- `npm run typecheck`: aprovado.
- `npm run lint`: aprovado.
- `npm run security:check`: aprovado.
- `npm run verify:migrations`: 12 migrations válidas.
- Smoke do parser CSV: aprovado.
- `git diff --check`: aprovado.

O build completo não foi executado no ambiente Linux de geração porque o pacote nativo `@next/swc-linux-x64-gnu` precisaria ser baixado e o registry do ambiente retornou HTTP 503. O projeto deve ser validado no Windows com `npm.cmd test` e `npm.cmd run build` antes do push.

## Limites honestos desta versão

- A importação desta entrega é CSV. XLSX, mapeamento visual de colunas e rollback automático entram em uma evolução posterior.
- Os horários e links de videochamada já funcionam, mas a criação automática de Google Meet, Teams e Zoom ainda requer as integrações OAuth correspondentes.
- A proposta possui aceite rastreável, mas ainda não substitui uma assinatura eletrônica juridicamente qualificada.
- O portal usa link seguro com token revogável; login próprio do candidato e MFA não fazem parte desta versão.
