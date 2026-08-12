# Backlog

Itens conhecidos e deliberadamente adiados, com dono/critério de reavaliação — não escondidos. Ver `docs/engineering/quality-strategy.md` §12 (política de honestidade sobre dívida técnica).

## Phase 0 — Foundations (2026-08-11): concluído

Ver `docs/operations/phase-0-kickoff-prompt.md` e ADR-010 para o registro completo das decisões tomadas.

```text
[x] Repositório Git inicializado, repositório GitHub criado
      (marcelo-jgoncalves/event-discovery-platform, público — ver ADR-010 §3)
[x] Branch protection em main confirmada via API (enforce_admins,
      required_pull_request_reviews com required_approving_review_count=0
      — projeto solo, ver ADR-010 §4 —, no force-push, no deletion,
      conversation resolution obrigatória)
[x] OIDC Provider do GitHub reaproveitado (conta 975707451904, já existia
      do projeto marcelo-goncalves-blog)
[x] IAM role edp-dev-role-cicd-github-actions criada via Terraform
      (infrastructure/terraform/modules/iam-github-oidc/), trust policy
      corrigida para a claim real do GitHub (ADR-010 §2)
[x] Policy de CI escopada a edp-* + state bucket, sem Resource: "*",
      sem permissão de apply de produto ainda
[x] Pipeline Tier A rodando de verdade em PR/push (.github/workflows/
      ci.yml, security.yml): typecheck, lint, format:check, unit,
      integration-fast (DynamoDB Local), dependency review, npm audit,
      Semgrep, Gitleaks, terraform validate+plan, TFLint, Trivy IaC —
      todos os 9 checks verdes, confirmado ao vivo via gh run view
[x] Actions pinadas por SHA, npm ci (nunca npm install), Node 24 pinado
      (.nvmrc + engine-strict)
```

## Phase 1 — Identity (2026-08-11): concluído (com itens explicitamente adiados abaixo)

Ver `docs/architecture/spec-identity.md` e ADR-012 para o registro completo das decisões.

```text
[x] spec-identity.md: schema de UsersTable (PROFILE/CONSENT), fluxo Cognito
      (API direta, sem Hosted UI), consentimento versionado, estado DELETING,
      retenção de 30 dias (número deste projeto, não herdado do blog)
[x] ADR-012 (Cognito vs. alternativa, schema de UsersTable) aceito antes de
      qualquer Terraform de identity (CLAUDE.md Nível 6)
[x] Terraform: Cognito User Pool + App Client (confidencial, secret em
      Secrets Manager) + UsersTable (infrastructure/terraform/modules/identity/)
      — terraform validate + plan (dev) verificados localmente
[x] resource-naming.md §10.1 (Cognito) adicionado — gap identificado, não
      drift (o documento nunca cobria Cognito antes)
[x] services/identity: domain (types, consent, account-status), pii/
      (cognito-client, hash — único módulo autorizado a tocar PII bruta),
      infra (UsersTableRepository), application (signup, login)
[x] Testes unit (consent versionado, transição de status, hash de PII) e
      integration-local (DynamoDB Local, UsersTableRepository) — unit
      verificados rodando (10/10 pass); integration verificado por leitura de
      código e por já rodar no mesmo padrão do CI (.github/workflows/ci.yml
      job integration-fast), mas não executado localmente nesta sessão por
      falta de Docker/Java no ambiente de execução — depende do serviço
      dynamodb-local que CI já sobe via container
[x] Architecture Fitness Function QR-012 (nenhum módulo fora de
      services/identity importa services/identity/src/pii/*) — fixture
      inválida e válida comprovadas via `npm run quality:self-test` antes de
      promover a regra a quality-rules.md
[x] Semgrep custom rule QR-013 (EDP004 — no raw PII log) — fixture inválida
      e válida comprovadas via semgrep --error localmente antes de promover
      a regra; wired em .github/workflows/security.yml
[x] CI Tier A atualizado: job `verify` roda `quality:check` (fitness
      function), job `infra` cobre o novo Terraform, Semgrep inclui
      quality/policies/code/ — verificado localmente (typecheck/lint/
      test/quality:check/terraform validate todos verdes), não confirmado
      ao vivo via `gh run view` nesta sessão (nenhum push feito)
```

Adiado explicitamente (não esquecimento — ver `docs/architecture/spec-identity.md` §10 e ADR-012):

```text
[ ] Endpoint HTTP de confirmação de email / reset de senha dedicado →
      trigger: quando existir um consumidor real (apps/web ou
      apps/telegram-webhook)
[ ] Vínculo de conta com Telegram (chatId) → trigger: Phase 5
[ ] Exclusão de conta ponta-a-ponta (execução real de DELETING: apagar
      Cognito + UsersTable + futuras entradas em InterestIndexTable) →
      trigger: Phase 3+, quando houver dado real de usuário para apagar
[ ] MFA administrativo obrigatório → decisão explícita registrada em
      ADR-012 (não esquecimento): dono = arquitetura (Marcelo), prazo de
      revisão = antes do primeiro deploy em produção com usuários reais
      (Phase 7 — Production Readiness)
[ ] Cognito Hosted UI / branding customizado → trigger: primeiro frontend
      web real (apps/web) com razão de produto para customizar
[ ] Histórico completo de versões de consentimento (hoje só a versão
      vigente por purpose é mantida) → trigger: requisito real de auditoria
      retroativa
[ ] Teste de integração real do fluxo Cognito (signup/login) contra um User
      Pool de dev implantado → trigger: Tier B, quando existir ambiente dev
[ ] Endpoint HTTP real (API Gateway/Lambda) expondo signup/login —
      services/identity hoje só expõe as funções de aplicação, sem handler
      HTTP ainda (nenhum consumidor real além deste spec)
```

## Quality enforcement system (ver ADR-011, `docs/engineering/quality-enforcement-system.md`)

Esqueleto de diretórios (`quality/`) e scripts de orquestração (`npm run quality:check`, `quality:self-test`, `audit:reality`, `audit:project`) já existem. A partir da Phase 1 (Identity), `quality:check`/`quality:self-test` deixaram de reportar "0 policies" — ver QR-012/QR-013 em `docs/engineering/quality-rules.md`. `audit:reality` já verifica de verdade branch protection e a IAM role de CI via API. O que falta, com trigger explícito de quando implementar:

```text
[ ] Custom Semgrep rules EDP001-003, EDP005-007 (Scan proibido, chamada
      direta ao Telegram fora do provider, redirect inseguro, wildcard IAM
      em código, payload de provider vazando ao domínio, HTML perigoso sem
      sanitizer) → trigger: quando o módulo correspondente (matcher,
      dispatcher, tracking, connectors) tiver o primeiro código real
      (EDP004 — raw PII log — já implementado, ver QR-013)
[ ] OPA/Rego (ou equivalente) para policy-as-code de Terraform (POL-IAM-001
      wildcard, POL-DDB-001 PITR em prod, POL-SQS-001 DLQ obrigatória,
      POL-LAMBDA-001 Function URL pública proibida, POL-LOG-001 retenção
      explícita, POL-TAGS-001 tags obrigatórias, POL-SECRETS-001 Secrets
      Manager) → trigger: quando o primeiro Terraform de recurso de
      produto (DynamoDB/SQS/Lambda) for adicionado (identity já existe;
      próximo trigger real é catalog/matching/notification)
[ ] Architecture Fitness Functions adicionais (Ticketmaster só em
      connectors/ticketmaster, Telegram só em
      notifications/providers/telegram) → trigger: quando
      services/matching, services/notification e connectors/ticketmaster
      tiverem o primeiro arquivo real (no-external-pii-import — identity —
      já implementado, ver QR-012)
[ ] Control Integrity Tests adicionais → trigger: nasce junto com cada
      policy/fixture nova, nunca depois (padrão já seguido em QR-012/QR-013)
[ ] Reality audit expandida (GuardDuty, CloudTrail, PITR, Lambda
      concurrency, SQS DLQ attached, Cognito, log retention) → trigger:
      quando os recursos AWS correspondentes existirem (a maioria depende
      de Tier B / primeiro ambiente dev implantado)
[ ] Infra drift detection agendado (terraform plan -detailed-exitcode
      nightly) → trigger: quando houver Terraform de produto suficiente
      para drift ser um risco real (hoje só a IAM role de CI existe)
[ ] Provider Contract Audit agendado (TMDB/Ticketmaster canaries) →
      trigger: quando os connectors tiverem o primeiro código real
[ ] Auditoria semanal dos próprios controles (control-integrity roda todas
      as fixtures inválidas) → trigger: quando houver ao menos uma policy
      real registrada
[ ] Quality Rule Registry (docs/engineering/quality-rules.md) expandido
      conforme cada item acima ganhar enforcement real — nunca listar lá
      antes do mecanismo existir
```

## Bootstrap pendente (ver `docs/engineering/quality-strategy.md` §15)

Explicitamente fora do escopo da Phase 0 (`docs/operations/phase-0-kickoff-prompt.md` §5) — depende de ambiente dev implantado, que ainda não existe.

```text
[ ] Tier B (integration-aws-real, E2E, smoke, validação IAM real,
      DAST baseline) — depende de ambiente dev implantado
[ ] Tier C (scale, failure, DAST completo, restore drill) — depende de Tier B
[ ] CD real (terraform apply automático de recursos de produto) — decisão
      arquiteturalmente significativa, merece ADR próprio quando chegar
      (ver ADR-010, trigger de revisão)
[ ] CloudTrail + GuardDuty no primeiro ambiente AWS
[ ] Formalizar os ADRs consolidados just-in-time, antes da implementação
      do componente afetado (docs/engineering/decisions/) — ADR-001 a
      ADR-009 continuam pendentes de criação; ADR-010 já existe
[ ] Testes de regra de negócio crítica (quality-strategy.md §3) como
      primeiro E2E
[ ] Dashboards de SLO (Match/Delivery Latency, queue age) antes do
      primeiro usuário real
[ ] Política de retenção de dados/consentimento documentada antes de
      armazenar o primeiro dado de usuário real
[ ] Implementar Data Quality invariants + métricas (quality-strategy.md §5.4)
      antes do primeiro evento real poder ficar READY
[ ] Habilitar Dependabot security updates (Dependency Review já está
      ativo no Tier A; falta o bot de atualização automática)
[ ] Adicionar DAST Tier B e threat model inicial antes do primeiro beta
[ ] Adicionar axe/Playwright para fluxos críticos do frontend
[ ] Executar primeiro restore drill antes de considerar backup "validado"
[ ] Definir política de exceções de qualidade com owner + expiry (ADR-009)
```

## Engenharia de contexto — P1/P2 adiados conscientemente

Ver `docs/engineering/audits/2026-08-11-revisao-estrategia-contexto.md` (P0 já aplicado) e `docs/context-strategy.md` §12.

```text
[ ] Metadata YAML (status/owner/authority) em todos os documentos de
      docs/, não só nos normativos centrais já cobertos
[ ] npm run context:check — links quebrados, índice de ADR ↔ arquivos,
      doc ativo referenciando arquivo superseded, backlog trigger resolve
[ ] Lifecycle explícito de docs/engineering/audits/ (quando um achado de
      auditoria é considerado resolvido/arquivado)
[ ] Definir trigger numérico de migração de docs/backlog.md para issue
      tracker (equipe/itens simultâneos acima de N)
[ ] AGENTS.md como contrato agnóstico de IA, com CLAUDE.md como adapter —
      só se/quando múltiplos agentes de IA passarem a trabalhar no projeto
```

## Fora do MVP por decisão consciente (não implementar sem trigger)

Regra: o valor do trigger (número, condição) vive uma vez, no spec ou ADR. Esta lista referencia onde o trigger está definido — nunca repete o valor aqui. Se o valor mudar no spec/ADR, esta lista não precisa mudar.

```text
EventBridge como domain bus central          → trigger: ADR-001
Entity resolution fuzzy/IA                    → trigger: ADR-002
Sharding de partição DynamoDB                 → trigger: ADR-003
Contador de assinantes síncrono               → trigger: spec-dynamodb §32
Telegram Paid Broadcasts / multi-bot          → trigger: ADR-004
Scheduler de fairness estrita entre filas     → trigger: ADR-004
FIFO por usuário                              → trigger: ADR-004
Multi-região, cell architecture, OpenSearch,
  DAX, Global Tables                          → trigger: nenhum definido ainda,
                                                  requer evidência de escala real
Auto-tuning de rate limit                     → trigger: ADR-004
WhatsApp, Push, Email                         → trigger: ADR-006 (segundo canal
                                                  com demanda real)
```

## Dívida técnica conhecida

_(vazio — nenhum código de produto implementado ainda, só fundação de CI/CD/IaC (Phase 0) e o esqueleto do sistema de qualidade. Preencher conforme surgir, seguindo o padrão: item + causa + decisão de adiar + condição de retomada.)_
