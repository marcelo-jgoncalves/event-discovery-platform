# Backlog

Itens conhecidos e deliberadamente adiados, com dono/critério de reavaliação — não escondidos. Ver `docs/engineering/quality-strategy.md` §12 (política de honestidade sobre dívida técnica).

## Bootstrap pendente (ver `docs/engineering/quality-strategy.md` §13)

```text
[ ] Formalizar os ADRs consolidados just-in-time, antes da implementação
      do componente afetado (docs/engineering/decisions/)
[ ] Configurar CI Tier A/B/C (quality-strategy.md §1.1), incluindo verify,
      Dependency Review, Semgrep, Gitleaks, npm audit, Trivy/TFLint e
      integration-aws-real
[ ] CloudTrail + GuardDuty no primeiro ambiente AWS
[ ] Branch protection confirmada via API antes do primeiro merge em main
[ ] Testes de regra de negócio crítica (quality-strategy.md §3) como
      primeiro E2E
[ ] Dashboards de SLO (Match/Delivery Latency, queue age) antes do
      primeiro usuário real
[ ] Política de retenção de dados/consentimento documentada antes de
      armazenar o primeiro dado de usuário real
[ ] Implementar Data Quality invariants + métricas (quality-strategy.md §5.4)
      antes do primeiro evento real poder ficar READY
[ ] Habilitar Dependabot + Dependency Review e pin de Node/package manager
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

_(vazio — projeto ainda não iniciou implementação. Preencher conforme surgir, seguindo o padrão: item + causa + decisão de adiar + condição de retomada.)_
