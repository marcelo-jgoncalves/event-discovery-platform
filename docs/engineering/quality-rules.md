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

## Regras planejadas sem enforcement ainda (ver `docs/backlog.md`)

Não duplicar aqui — a lista completa com trigger de habilitação vive em `docs/backlog.md`, seção "Quality enforcement system". Exemplos do que falta mecanismo (custom Semgrep EDP001-007, OPA/Rego para Terraform, architecture fitness functions, control integrity tests, reality audits agendadas): todos dependem de código de produto que ainda não existe.
