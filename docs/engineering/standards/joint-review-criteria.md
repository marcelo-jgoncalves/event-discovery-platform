---
status: active
owner: engineering
authority: normative
---

# Critérios de revisão conjunta Claude↔Codex, por eixo

Fonte única dos critérios de avaliação (nome, peso, definição) usados nas revisões conjuntas Claude↔Codex (`AGENTS.md` §2). Os documentos de auditoria em `docs/engineering/audits/` (Evidence) registram rodadas, notas e achados de uma execução específica do protocolo — nunca redefinem ou duplicam a tabela de critérios; apenas linkam para a seção correspondente aqui.

Cada eixo é definido uma vez, por convergência independente entre Claude e Codex (ver procedimento em `AGENTS.md` §2.1), e não é reaberto a cada nova rodada de revisão sobre o mesmo eixo — só evolui se o próprio critério se mostrar mal calibrado (registrar por que, junto com a mudança).

---

## Eixo: Arquitetura

Convergido em 2026-08-19 (fontes: ISO/IEC 25010, AWS Well-Architected, ATAM). Primeira aplicação registrada em `docs/engineering/audits/2026-08-19-joint-architecture-review.md`.

| # | Critério | Peso |
|---|---|---:|
| 1 | Domain Fit & Simplicity | 11% |
| 2 | Reliability & Fault Recovery | 13% |
| 3 | Event & Integration Correctness | 10% |
| 4 | Data Model & Consistency | 10% |
| 5 | Security & Privacy | 11% |
| 6 | Modifiability & Evolvability | 9% |
| 7 | Observability & Operability | 9% |
| 8 | Testability & Delivery Safety | 8% |
| 9 | Cost & Resource Governance | 6% |
| 10 | Performance & Scalability Fitness | 5% |
| 11 | Architecture Governance & Traceability | 8% |

---

## Eixo: Qualidade de engenharia

Convergido em 2026-08-19 (fontes: ISO/IEC 25010 maintainability, DORA/Core-4). Primeira aplicação registrada em `docs/engineering/audits/2026-08-19-joint-engineering-quality-review.md`. Eixo distinto do de Arquitetura — craft de código, disciplina de testes, rigor de CI, tooling, disciplina de documentação/processo, gestão de dívida técnica; não redecide design de sistema.

| # | Critério | Peso | Definição |
|---:|---|---:|---|
| 1 | Code Correctness & Defensive Design | 11% | Preservação de invariantes via validação explícita, tratamento de falha, transições de estado seguras, ausência de corrupção silenciosa. |
| 2 | Test Effectiveness & Coverage Discipline | 14% | Evidência crível de unit/integration/contract/negative/failure/regression focada em risco real, não apenas contagem/cobertura de linha. |
| 3 | CI Quality Gates & Merge Safety | 11% | Enforcement determinístico de checks obrigatórios em toda mudança, sem bypass informal, exceções formalmente governadas. |
| 4 | Type Safety, Static Analysis & Automated Enforcement | 9% | Uso efetivo de tipagem estrita, lint, SAST, policy checks e fitness functions customizadas para prevenir classes de defeito automaticamente. |
| 5 | Readability, Consistency & Implementation Maintainability | 9% | Código coeso, nomeado claramente, estilo consistente, DRY/KISS/YAGNI aplicado com julgamento, barato de modificar. |
| 6 | Delivery, Release & Recovery Discipline | 8% | Artefatos/ambientes reproduzíveis, promoção segura, evidência de deploy, rollback, validação de recuperação proporcional à maturidade do projeto. |
| 7 | Dependency & Supply-Chain Hygiene | 7% | Dependências controladas, lockfiles, actions/tools pinados, triagem de vulnerabilidade, secret scanning, SBOM/provenance quando cabível. |
| 8 | Debuggability & Operational Feedback | 6% | Diagnósticos estruturados e privacy-safe, correlation context, erros acionáveis, suficientes para investigar falhas assíncronas. |
| 9 | Developer Experience & Reproducibility | 6% | Instalar/validar/testar/rodar o monorepo npm a partir de checkout limpo, com comandos pinados, documentados, de baixo atrito. |
| 10 | Documentation Quality & Process Discipline | 6% | Specs, standards, decisões e registros de mudança claros e autoritativos, com rigor de processo proporcional a projeto solo. |
| 11 | Documentation–Implementation Drift Control | 7% | Checks determinísticos ou executados regularmente que detectam divergência entre documentação, código, infra, config de CI e realidade implantada. |
| 12 | Technical-Debt & Continuous-Improvement Practice | 6% | Registro honesto de atalhos e controles falhos, com dono, trigger, expiry quando aplicável, e follow-through baseado em evidência. |

---

## Como adicionar um novo eixo

Não criar a tabela de critérios dentro do primeiro doc de auditoria do eixo novo. Seguir `AGENTS.md` §2.1 (definição independente → convergência) e, ao final, adicionar aqui uma seção nova nesse mesmo formato — o doc de auditoria referencia a seção, não a duplica.
