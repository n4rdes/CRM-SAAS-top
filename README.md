# Prismae People OS

Prismae é um SaaS B2B que conecta CRM para consultorias de RH, ATS, cadastro de colaboradores, desempenho, clima, automações, People Analytics e controle de assinatura.

Esta entrega contém duas experiências:

- `/` — site comercial responsivo, planos Basic/Pro/Custom, FAQ, segurança e captação de demonstração;
- `/demo` — protótipo funcional do produto com onze áreas, busca, filtros, estados interativos, cadastro de candidato, assistente de IA e central de assinatura.

## Executar

```bash
npm run dev
```

Abra a URL informada pelo terminal. Para validar a entrega:

```bash
npm run build
npm run lint
```

## Estrutura principal

- `app/page.tsx` e `app/globals.css`: aquisição e conversão;
- `app/demo/page.tsx` e `app/demo/demo.css`: aplicação SaaS navegável;
- `lib/subscriptions.ts`: catálogo de planos e decisão de entitlement;
- `docs/PRODUCT_STRATEGY.md`: pesquisa, posicionamento, módulos e roadmap;
- `docs/PRODUCTION_ARCHITECTURE.md`: arquitetura multi-tenant, cobrança, segurança e LGPD.

## Estado da entrega

O site e o painel são um MVP de experiência de alta fidelidade. Pagamento real, login empresarial, banco de dados, envio de e-mail/WhatsApp, domínio e documentos jurídicos exigem credenciais e infraestrutura do proprietário antes do lançamento comercial. O desenho para implementar essas camadas está documentado em `docs/PRODUCTION_ARCHITECTURE.md`.

