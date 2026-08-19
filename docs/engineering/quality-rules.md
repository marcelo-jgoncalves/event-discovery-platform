---
status: active
owner: architecture
authority: normative
---

# Quality Rule Registry

Registry, não prosa (`quality-enforcement-system.md` §12 / ADR-011). Cada linha responde "quem garante isso?" com um mecanismo verificável — nunca "a IA deveria lembrar". Uma regra sem enforcement real listado aqui como se tivesse é pior do que não listar: dá falsa confiança (mesmo princípio de `testing-strategy.md` sobre mock vs. serviço real).

Regra de manutenção: só entra aqui uma regra com enforcement **já implementado e verificado** — não aspiracional. Regras planejadas, mas ainda sem mecanismo, vivem em `docs/backlog.md` com o trigger que as habilita.

| ID | Regra | Enforcement | Gate | Evidência |
|---|---|---|---|---|
| QR-001 | GitHub Actions pinadas por full commit SHA, nunca tag mutável | revisão manual do workflow (sem check automático ainda) | PR | `.github/workflows/*.yml` — todas as `uses:` atuais são SHA-pinned |
| QR-002 | `npm ci`, nunca `npm install`, no CI | hardcoded nos workflows | PR | `.github/workflows/ci.yml` |
| QR-003 | Node/npm pinados no repositório | `.nvmrc` + `engine-strict=true` em `.npmrc` | PR (`npm ci` falha se a versão divergir) | `.nvmrc`, `.npmrc` |
| QR-004 | Terraform obrigatório para todo recurso AWS, nenhum recurso manual | processo (sem check automático que detecte recurso criado fora do Terraform) | — | `infrastructure/terraform/` |
| QR-005 | IAM da role de CI sem `Resource: "*"`, escopada a `edp-*` | `terraform plan` + revisão do diff da policy | PR (infra job) | `infrastructure/terraform/modules/iam-github-oidc/main.tf` |
| QR-006 | Secret scan bloqueia segredo commitado | Gitleaks | PR | `.github/workflows/security.yml` |
| QR-007 | SAST bloqueia padrão OWASP/secrets/JWT conhecido | Semgrep (`p/typescript`, `p/nodejs`, `p/owasp-top-ten`, `p/secrets`, `p/jwt`) | PR | `.github/workflows/security.yml` |
| QR-008 | `terraform validate`/`plan`/TFLint/Trivy bloqueiam infra inválida ou insegura | CI job `infra` | PR | `.github/workflows/ci.yml` |
| QR-009 | `npm audit --audit-level=high` bloqueia dependência high/critical não triada | CI job `npm-audit` | PR | `.github/workflows/ci.yml` |
| QR-010 | Dependency review bloqueia dependência nova de risco conhecido | `actions/dependency-review-action` | PR | `.github/workflows/ci.yml` |
| QR-011 | Branch protection em `main` (PR obrigatório, sem force-push, sem delete) | GitHub branch protection API | GitHub (nativo) | confirmado via `gh api .../branches/main/protection` (ADR-010) |
| QR-012 | Nenhum módulo fora de `services/identity` importa `services/identity/src/pii/*` (raw user PII boundary) | Architecture Fitness Function (`quality/policies/architecture/no-external-pii-import.mjs`) | PR (CI job `verify` → `node quality/scripts/quality-check.mjs`) | fixture inválida (`quality/tests/fixtures/invalid/architecture/external-pii-import/`) comprovadamente rejeitada, fixture válida comprovadamente aceita — `npm run quality:self-test` |
| QR-013 | EDP004 — nenhum log com PII bruta (email, telefone, nome); sempre hash | Semgrep custom rule (`quality/policies/code/edp004-no-raw-pii-log.yaml`) | PR (`.github/workflows/security.yml`, job `semgrep`) | fixture inválida (`quality/tests/fixtures/invalid/code/edp004-raw-email-log.ts`) comprovadamente rejeitada (`semgrep --error` exit 1), fixture válida (`.../valid/code/edp004-hashed-email-log.ts`) comprovadamente aceita (exit 0) — `npm run quality:self-test` |
| QR-014 | Nenhum módulo fora de `connectors/tmdb`/`connectors/ticketmaster` referencia o host da API do provider correspondente (provider boundary, ADR-006) | Architecture Fitness Function (`quality/policies/architecture/no-external-provider-call.mjs`) | PR (CI job `verify` → `node quality/scripts/quality-check.mjs`) | fixture inválida (`quality/tests/fixtures/invalid/architecture/provider-isolation/`) comprovadamente rejeitada, fixture válida comprovadamente aceita — `npm run quality:self-test` |
| QR-015 | EDP005 — nenhuma chamada direta a `fetch()` de host de provider (TMDB/Ticketmaster) fora do connector correspondente | Semgrep custom rule (`quality/policies/code/edp005-no-direct-provider-call.yaml`) | PR (`.github/workflows/security.yml`, job `semgrep`) | fixture inválida (`quality/tests/fixtures/invalid/code/edp005-direct-provider-call.ts`) comprovadamente rejeitada (`semgrep --error` exit 1), fixture válida (`.../valid/code/edp005-provider-call-via-connector.ts`) comprovadamente aceita (exit 0) — `npm run quality:self-test` |
| QR-016 | Todo workspace real (`apps/`, `services/`, `connectors/`, `packages/` com `package.json`) declara os scripts `typecheck`, `lint` e `test` — `scripts/run-workspaces.mjs` usa `--if-present`, que silenciaria um workspace novo sem um desses scripts em vez de falhar o gate | Fitness function (`quality/policies/github/workspace-scripts-declared.mjs`) | PR (CI job `verify` → `node quality/scripts/quality-check.mjs`) | fixture inválida (`quality/tests/fixtures/invalid/github/workspace-scripts-declared/`, sem `test`) comprovadamente rejeitada, fixture válida comprovadamente aceita — `npm run quality:self-test`. Achado da revisão conjunta de qualidade de engenharia (2026-08-19, Codex) |
| QR-017 | Controle de integridade (`quality:self-test`) roda em todo PR, não só manualmente | hardcoded no workflow | PR (`.github/workflows/ci.yml`, job `verify`) | `.github/workflows/ci.yml` — step "Quality control self-test (fixture-based)". Achado da revisão conjunta de qualidade de engenharia (2026-08-19, Codex): antes desta correção, `quality:self-test` só era executado manualmente, nunca no CI |

## Regras planejadas sem enforcement ainda (ver `docs/backlog.md`)

Não duplicar aqui — a lista completa com trigger de habilitação vive em `docs/backlog.md`, seção "Quality enforcement system". QR-012/QR-013 (Phase 1 — Identity) e QR-014/QR-015 (Phase 2 — Catalog) são as regras promovidas desde ADR-011; o restante (EDP001-003/006-007, OPA/Rego para Terraform, demais architecture fitness functions, reality audits agendadas) continua dependendo de código de produto que ainda não existe nos módulos correspondentes.
