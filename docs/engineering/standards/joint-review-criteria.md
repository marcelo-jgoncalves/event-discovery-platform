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

## Eixo: Engenharia de contexto

Convergido em 2026-08-19 (fontes: pesquisa web sobre context engineering para desenvolvimento assistido por IA — Packmind context-engineering playbook, "AI Agents Do Not Fail Alone: The Context Fails First" (arXiv 2607.14275), "Context Rot in AI-Assisted Software Development" (arXiv 2606.09090, Treude & Baltes), Michael Nygard ADRs e práticas de lifecycle/supersession, Diátaxis para separação de propósitos documentais, progressive disclosure/information retrieval; combinada com leitura do repositório real — `docs/context-strategy.md`, `CLAUDE.md`, `AGENTS.md`, `docs/architecture/system-overview.md`, `docs/backlog.md`, `docs/engineering/decisions/`, `docs/engineering/audits/`). Convergência independente forte entre Claude e Codex — mesma cobertura semântica, pesos a no máximo 1,5pp de distância em cada critério, sem necessidade de rodada formal de desacordo (mesmo padrão observado no eixo de Arquitetura). Avalia a qualidade do próprio sistema de documentação/contexto do projeto — não código, não arquitetura de sistema, não craft de engenharia (eixos distintos, já cobertos acima).

| # | Critério | Peso | Definição |
|---:|---|---:|---|
| 1 | Canonicalidade, Autoridade & Não-Duplicação | 16% | Cada fato normativo tem exatamente uma fonte de verdade; derivados (índices, mapas, resumos) são explicitamente não autoritativos e referenciam a fonte em vez de copiá-la. Inclui coerência entre papéis documentais, Authority Matrix, specs, ADRs, standards e triggers referenciados pelo backlog. |
| 2 | Clareza de Papéis & Proporcionalidade | 10% | Cada documento tem propósito, escopo e autoridade inequívocos (agent rules, product intent, domain language, architecture/specs, decisions, standards, work state, operations, evidence), sem sobreposição semântica relevante. A estrutura permanece proporcional ao tamanho real do projeto — sem sofisticação antecipada. |
| 3 | Context Routing & Progressive Disclosure | 13% | Humanos e agentes conseguem identificar e carregar o menor conjunto suficiente de contexto para cada tipo de tarefa, escalando deliberadamente quando necessário. Avalia cobertura, precisão e navegabilidade dos read sets/mapas do context router (`system-overview.md`). |
| 4 | Correspondência com a Realidade & Controle de Drift | 15% | O sistema distingue intenção documentada, implementação declarada e estado efetivamente observado (código, Terraform, CI, o que está de fato implantado), detectando e reconciliando divergências explicitamente em vez de resolver silenciosamente para um lado. |
| 5 | Lifecycle, Proveniência & Evolução do Conhecimento | 12% | Cada classe de contexto tem estados e regras de evolução apropriados: arquitetura vigente vs. histórica, ADR aceito imutável e supersedido por ADR novo, metadata de status/autoridade, lifecycle de evidências. Deve ser possível determinar o que vale hoje e reconstruir por que e quando mudou. |
| 6 | Rastreabilidade de Decisões, Trabalho & Triggers | 10% | Decisões caras, desenhos vigentes, trabalho adiado, dívida técnica e evidências permanecem conectados sem virar sistemas paralelos concorrentes. ADRs criados no momento certo; backlog como work state honesto; triggers concretos, verificáveis e acompanhados após disparar. |
| 7 | Higiene de Contexto & Sinal-Ruído | 8% | Só conhecimento durável é promovido a destinos canônicos; raciocínio intermediário, planos temporários, transcrições e resumos redundantes são descartados (contexto efêmero). Ausência de versões concorrentes ou documentos órfãos que aumentem context rot. |
| 8 | Portabilidade Agnóstica entre Agentes de IA | 6% | Regras essenciais do projeto são utilizáveis por diferentes agentes/ferramentas sem dependência desnecessária de um fornecedor — divisão coerente entre `CLAUDE.md`, `AGENTS.md` e futuros pontos de entrada, sem duplicação nem instruções incompatíveis. |
| 9 | Auditabilidade & Enforcement do Sistema de Contexto | 10% | Afirmações sobre a saúde do contexto são verificáveis por evidência datada e revisões reproduzíveis — e, quando proporcional ao volume de documentos, por checks automatizados (links quebrados, índice ADR↔arquivos, doc ativo referenciando superseded). Achados têm lifecycle claro: aberto, corrigido, adiado conscientemente ou arquivado com rastreabilidade. |

## Como adicionar um novo eixo

Não criar a tabela de critérios dentro do primeiro doc de auditoria do eixo novo. Seguir `AGENTS.md` §2.1 (definição independente → convergência) e, ao final, adicionar aqui uma seção nova nesse mesmo formato — o doc de auditoria referencia a seção, não a duplica.
