---
status: applied
date: 2026-08-11
scope: docs/context-strategy.md, docs/architecture/, docs/engineering/decisions/
---

# Revisão da Estratégia de Contexto — Event Discovery Platform

> **P0 aplicado em 2026-08-11**: arquitetura única (`architecture.md` + `history/`), ADRs com lifecycle imutável/supersede, `docs/domain/glossary.md` criado, context routing + authority matrix + protocolo de drift em `system-overview.md`, regra de contexto efêmero em `CLAUDE.md`, deduplicação de triggers em `docs/backlog.md`. P1/P2 (metadata em todo doc, `context:check` automatizado, lifecycle de audits, trigger de saída do backlog, `AGENTS.md` agnóstico) permanecem como itens de backlog — ver `docs/backlog.md`. Este documento é mantido como evidência de como e por que a estrutura chegou ao estado atual; `docs/context-strategy.md` é a fonte normativa do desenho vigente.

## Objetivo deste documento

Este documento consolida a análise da estratégia de contexto do projeto sob a perspectiva de engenharia de contexto.

A avaliação geral é muito positiva: a estratégia já está acima do nível normalmente encontrado em projetos de MVP, especialmente por tratar contexto como um sistema de autoridade, organização e evolução — e não apenas como um conjunto de arquivos Markdown.

Avaliação geral:

> **8,7–9/10**

A base está correta, mas existem alguns ajustes importantes que devem ser feitos antes de o projeto acumular mais implementação, documentos e agentes.

---

# 1. O princípio central está correto, mas deve ser refinado

Princípio atual:

> Cada fato tem exatamente um lugar canônico. Todo outro lugar aponta para ele, nunca o duplica.

A ideia está correta, porém vale refiná-la para:

> **Cada fato normativo tem exatamente uma fonte canônica. Representações derivadas podem existir, desde que sejam explicitamente não autoritativas e apontem para a fonte.**

Isso permite casos legítimos como:

```text
Canonical spec
     ↓
system-overview
     ↓
resumo / índice / contexto carregado pela IA
```

O problema não é existir informação derivada.

O problema é existirem duas fontes que possam simultaneamente afirmar:

```text
"eu sou a verdade"
```

Essa distinção é fundamental para engenharia de contexto assistida por IA.

---

# 2. Existe uma violação real da própria regra de canonicalidade

A estratégia atual indica que triggers de evolução vivem nos specs e são também replicados no backlog.

Isso deve ser corrigido.

Exemplo ruim:

```text
spec:
sharding quando X > 100k

backlog:
sharding quando X > 100k
```

Esse desenho cria risco de divergência futura.

O correto:

```text
spec:
TRIGGER-SHARD-001
Followers per partition > X

backlog:
Evaluate sharding
Trigger: spec-dynamodb-access-patterns.md#TRIGGER-SHARD-001
```

Regra:

> O valor vive uma vez. O backlog guarda apenas a referência.

Essa correção deve ser feita imediatamente.

---

# 3. V1 e V2 não devem permanecer como duas arquiteturas ativas

Hoje existem:

```text
arquitetura-mvp-event-discovery-platform.md
arquitetura-v2-revisao-mvp-event-discovery.md
```

com uma regra dizendo que V2 prevalece sobre V1.

Isso funciona enquanto existem duas versões.

Mas tende a degradar para algo como:

```text
arquitetura-v1
arquitetura-v2
arquitetura-v3
arquitetura-v4-final
arquitetura-v4-final-revised
```

Esse é exatamente o tipo de estrutura que gera erros para humanos e agentes.

Recomendação:

```text
docs/architecture/
  system-overview.md
  architecture.md             ← única arquitetura vigente
  spec-dynamodb-access-patterns.md
  spec-notification-delivery.md

  history/
    architecture-v1.md
    architecture-v2-transition.md
```

Ou, preferencialmente, quando o histórico não tiver valor operacional:

```text
Git = histórico
architecture.md = verdade vigente
```

Essa mudança é **P0**.

---

# 4. ADRs aceitos não devem ser expandidos indefinidamente

A estratégia atual sugere:

```text
Existe ADR do componente?
→ Expandir esse ADR
```

Isso deve mudar.

Um ADR aceito é um **registro histórico de uma decisão tomada naquele momento**.

Lifecycle recomendado:

```text
PROPOSED
ACCEPTED
SUPERSEDED
DEPRECATED
REJECTED
```

Exemplo:

```text
ADR-003
DynamoDB projections instead of GSI
Status: ACCEPTED
```

Futuramente, se GSI se tornar a melhor opção:

```text
ADR-021
Adopt GSI for Interest Index

Supersedes: ADR-003
```

E o ADR anterior passa para:

```text
Status: SUPERSEDED
Superseded-by: ADR-021
```

Princípio:

> ADR aceito é imutável como decisão histórica, salvo correção editorial.

Isso preserva não apenas o estado atual, mas também:

> por que o sistema evoluiu daquela maneira.

---

# 5. Os cinco papéis de documento não cobrem todo o sistema

A estratégia define cinco papéis principais, mas também possui:

```text
docs/operations/
docs/runbooks/
docs/engineering/audits/
```

que não se encaixam claramente nessa taxonomia.

Recomenda-se uma classificação um pouco mais completa:

| Papel | Pergunta respondida |
|---|---|
| Agent rules | Como agentes devem trabalhar? |
| Product intent | O que estamos construindo e por quê? |
| Domain language | O que significam nossos conceitos? |
| Architecture/specs | Como deve funcionar? |
| Decisions | Por que escolhemos isso? |
| Quality/standards | Que qualidade é exigida? |
| Work state | O que ainda precisa acontecer? |
| Operations | Como operar/recuperar o sistema? |
| Evidence | O que foi efetivamente verificado? |

Isso não aumenta a complexidade prática.

Pelo contrário, reduz ambiguidade.

Especialmente:

```text
audits
```

devem ser considerados **evidência**, não arquitetura ou backlog.

---

# 6. Criar um Domain Glossary agora

Essa é uma das recomendações de maior valor.

O projeto já possui conceitos como:

```text
Work
Event
Screening
Interest
Target
LocationScope
Offer
NotificationCandidate
CanonicalEvent
ResolutionStatus
EnrichmentStatus
```

Sem uma linguagem canônica, é provável que com o tempo apareçam variações como:

```text
event
occasion
show
screening
session
movieEvent
cinemaEvent
```

sendo usadas para coisas diferentes.

Isso é especialmente prejudicial para agentes de IA.

Criar:

```text
docs/domain/
  glossary.md
```

Exemplo:

```markdown
## Work

Uma entidade cultural abstrata que pode originar eventos concretos.

Examples:
- Interstellar
- The Lord of the Rings
- Hamlet

Not:
- Interstellar at Cineart Boulevard, 20:30
  → this is an Event/Screening.
```

Regra:

> Se um termo tiver significado específico no domínio, sua definição vive no glossary.

Specs usam o termo.

Specs não redefinem o termo.

---

# 7. O principal gap atual é Context Routing

A estratégia atual responde muito bem:

> Onde está a informação?

Mas ainda precisa responder:

> **Qual conjunto mínimo de contexto uma IA deve carregar para executar esta tarefa?**

Esse é o próximo nível de maturidade.

Criar **read sets** por tipo de trabalho.

## Implementar feature

```text
ALWAYS
AGENTS/CLAUDE
relevant backlog item

THEN
relevant spec
relevant accepted ADR
testing standard
code being modified
```

## Alterar arquitetura

```text
AGENTS/CLAUDE
product vision
architecture.md
relevant specs
relevant ADRs
quality strategy
```

## Corrigir bug

```text
AGENTS/CLAUDE
relevant spec
actual code
tests
latest relevant audit
runbook if operational
```

## Trabalhar no DynamoDB Matcher

```text
AGENTS/CLAUDE
domain/glossary.md
architecture.md
spec-dynamodb-access-patterns.md
ADR-003
testing-strategy.md
relevant source code
```

Evitar:

```text
read everything in docs/
```

Esse mecanismo implementa:

> **Progressive disclosure of context.**

---

# 8. `system-overview.md` deve se tornar o router de contexto

O `system-overview.md` já foi corretamente definido como mapa e não como fonte normativa.

Esse papel pode ser ampliado.

Exemplo:

```text
# System Context Map

## Start here

Architecture work
→ architecture.md

Matching work
→ spec-dynamodb-access-patterns.md
→ ADR-003

Notification work
→ spec-notification-delivery.md
→ ADR-004

Quality work
→ quality-strategy.md

Product decision
→ product/vision.md
```

Depois:

```text
## Context routes

Task: implement matcher

Read:
1. AGENTS/CLAUDE
2. domain/glossary
3. spec-dynamodb-access-patterns
4. ADR-003
5. testing-strategy
```

O `system-overview.md` passa a funcionar como:

> **Context Router para agentes.**

Isso é muito valioso.

---

# 9. Tornar as instruções de raiz agnósticas de fornecedor de IA

Existe um pequeno desalinhamento conceitual.

A estratégia fala de IA como parte relevante do time, mas o contrato principal está em:

```text
CLAUDE.md
```

Se o projeto for trabalhar com múltiplos agentes, considerar:

```text
AGENTS.md
```

como contrato canônico neutro.

E:

```text
CLAUDE.md
```

como adapter específico:

```text
Read and follow AGENTS.md.

Claude-specific instructions:
...
```

Também podem existir futuramente adapters para outras ferramentas.

Regra obrigatória:

> Nunca duplicar as mesmas instruções em AGENTS.md, CLAUDE.md, COPILOT.md etc.

Um arquivo deve ser canônico.

Os demais apenas apontam para ele e registram diferenças específicas de provider.

---

# 10. Definir explicitamente o que NÃO vira contexto persistente

Isso é essencial para impedir entropia documental.

Sem essa regra, agentes tendem a criar arquivos como:

```text
analysis-final.md
notes-feature.md
investigation-v2.md
plan-new.md
final-final.md
```

Criar uma seção específica:

## Ephemeral Context

Não persistir como documentação canônica:

```text
raw AI conversations
temporary reasoning
one-off investigation notes
temporary implementation plans
intermediate summaries
generated explanations already represented elsewhere
```

Esse material é:

```text
scratch
```

e deve desaparecer depois da tarefa.

Somente o resultado durável é promovido:

```text
decision → ADR
design → spec
work deferred → backlog
rule → standard
domain fact → glossary
```

Essa disciplina reduz drasticamente a degradação do contexto.

---

# 11. Distinguir Intended Truth de Observed Truth

Esse é um ponto de grande importância.

Exemplo:

```text
spec:
Lambda concurrency = 5

Terraform:
Lambda concurrency = 10

AWS:
Lambda concurrency = 10
```

Qual é a verdade?

Na prática temos três verdades diferentes:

```text
INTENDED DESIGN
spec = 5

IMPLEMENTED STATE
Terraform = 10

DEPLOYED REALITY
AWS = 10
```

O sistema possui drift.

Adicionar uma **Authority Matrix**.

| Pergunta | Fonte |
|---|---|
| O que queremos construir? | product vision |
| Como deveria funcionar? | active spec |
| Por que escolhemos assim? | ADR |
| Como está implementado? | código/IaC |
| O que está realmente rodando? | AWS/API/CLI |
| O que falta? | backlog |
| O que já foi validado? | audit evidence |

Quando houver divergência:

> Não escolher silenciosamente um vencedor. Registrar drift.

Essa matriz complementa perfeitamente a disciplina já adotada de:

> Auditar contra a realidade.

---

# 12. Adicionar metadata mínima aos documentos canônicos

Não é necessário criar metadados complexos.

Algo simples basta.

Documento ativo:

```yaml
---
status: active
owner: architecture
authority: normative
---
```

Documento histórico:

```yaml
---
status: superseded
supersededBy: ../architecture.md
authority: historical
---
```

ADR:

```yaml
---
status: accepted
date: 2026-08-11
supersedes: []
---
```

Objetivo:

permitir que humanos e agentes respondam rapidamente:

> Este documento pode ser usado como fonte normativa?

---

# 13. A estratégia de contexto deve se tornar executável

Da mesma forma que a estratégia de qualidade possui gates automáticos, a estratégia de contexto também deve ter verificações.

Criar futuramente:

```text
npm run context:check
```

Validações possíveis:

```text
broken internal links

ADR index ↔ ADR files consistency

active ADRs have required metadata

superseded docs point to replacement

no active doc links to superseded architecture

required context files exist

backlog trigger references resolve

no duplicate ADR numbers

Markdown lint
```

Também pode validar:

```text
architecture docs referenced from system-overview
```

A canonicalidade semântica completa não pode ser automaticamente provada.

Mas grande parte do drift estrutural pode ser detectado.

---

# 14. `docs/backlog.md` precisa de estratégia de saída

`docs/backlog.md` funciona muito bem enquanto o projeto tem:

```text
1 developer
small MVP
few parallel workstreams
```

Mas tende a ficar limitado com:

```text
many issues
multiple developers
priorities
assignees
dependencies
milestones
```

Definir trigger explícito.

Exemplo:

```text
docs/backlog.md remains canonical while:
- team <= N
- active work items <= N
- no need for workflow automation
```

Quando ultrapassar o limite:

```text
GitHub Issues / GitHub Projects
becomes work-state canonical source
```

Então:

```text
docs/backlog.md
```

vira apenas um ponteiro ou é removido.

Nunca manter:

```text
GitHub Issues
+
docs/backlog.md
```

como dois sistemas paralelos de trabalho.

---

# 15. Diretórios vazios não precisam existir agora

A estratégia reserva namespaces como:

```text
docs/api/
docs/operations/
docs/runbooks/
docs/engineering/audits/
```

A intenção está correta.

Mas o próprio `context-strategy.md` já documenta onde esses elementos nascerão.

Então a recomendação é:

> manter o namespace planejado no documento, mas criar a pasta física somente no primeiro uso.

Isso reduz ruído no repositório e mantém coerência com:

> sophistication follows observed complexity.

---

# 16. `vision.md` deve continuar pequeno, mas semanticamente completo

Não transformar:

```text
docs/product/vision.md
```

em roadmap.

O arquivo deve conter:

```text
Problem

Target user

Core value proposition

Product principles

MVP boundary

Non-goals

Success definition
```

Não deve conter:

```text
Phase 1
Phase 2
tickets
technical backlog
weekly priorities
```

Esses elementos pertencem ao estado de trabalho/roadmap.

Regra:

> `vision.md` pequeno, estável e semanticamente completo.

---

# 17. Os 9 ADRs agrupados estão no nível certo

A consolidação de 19 ADRs para 9 foi uma boa decisão.

Manter o agrupamento por decisão/cohesive component.

A única mudança obrigatória:

```text
Accepted ADR = immutable historical decision
```

Uma decisão nova gera:

```text
new ADR
     ↓
supersedes old ADR
```

e não alteração retroativa do ADR histórico.

---

# 18. ADR antes de implementar é uma regra realista

Sim, desde que o critério seja correto.

ADR não é necessário para:

```text
rename variable
add endpoint
change function
small refactor
implementation detail
```

ADR deve existir quando a escolha for:

```text
expensive to reverse
cross-cutting
architecturally significant
changes a previous invariant
```

Nesse contexto:

```text
5–15 minutos registrando a decisão
```

antes de implementar algo que pode custar semanas para migrar depois é uma excelente troca.

O risco seria criar ADR para qualquer detalhe.

A consolidação para 9 ADRs já reduz esse problema.

---

# 19. Estrutura de contexto recomendada

Arquitetura sugerida:

```text
AGENTS.md                           Canonical agent contract
CLAUDE.md                           Claude adapter, if necessary

docs/
│
├── product/
│   └── vision.md
│
├── domain/
│   └── glossary.md
│
├── architecture/
│   ├── system-overview.md          Context router / reading map
│   ├── architecture.md             SINGLE current architecture
│   ├── spec-dynamodb-access-patterns.md
│   ├── spec-notification-delivery.md
│   └── history/
│
├── engineering/
│   ├── quality-strategy.md
│   ├── standards/
│   │   ├── principles.md
│   │   ├── code-conventions.md
│   │   ├── testing-strategy.md
│   │   └── git-and-review-workflow.md
│   │
│   ├── decisions/
│   │   ├── README.md
│   │   ├── _template.md
│   │   └── adr-NNN-*.md
│   │
│   └── audits/
│
├── backlog.md
│
├── api/
├── operations/
└── runbooks/
```

Os três últimos diretórios devem ser criados fisicamente somente quando houver conteúdo real.

---

# 20. Lifecycle obrigatório de contexto por tarefa

Toda tarefa deve seguir um fluxo semelhante:

```text
TASK START
   ↓
identify task type
   ↓
load minimum context route
   ↓
inspect code/reality
   ↓
work
   ↓
validate
   ↓
context impact check
```

No final:

```text
Did architecture change?
→ update spec

Was an expensive decision made?
→ ADR

Was terminology introduced?
→ glossary

Was something deferred?
→ backlog

Did operational behavior change?
→ runbook

Did no durable knowledge change?
→ DO NOT CREATE DOCUMENTATION
```

A última regra é particularmente importante:

> **Não documentar também pode ser a decisão correta.**

---

# 21. Prioridade das mudanças

## P0 — fazer agora

1. Criar um único `architecture.md` vigente.
2. Retirar V1/V2 da área ativa.
3. ADR aceito se torna imutável; decisões futuras supersedem.
4. Remover duplicação dos triggers entre specs e backlog.
5. Criar `docs/domain/glossary.md`.
6. Adicionar Context Routing/read sets ao `system-overview.md`.
7. Criar Authority Matrix / protocolo de drift.
8. Definir regra explícita de contexto efêmero.

---

## P1 — antes do projeto crescer significativamente

9. Adicionar metadata `status/authority/supersedes`.
10. Criar `context:check` no CI.
11. Definir lifecycle dos audits.
12. Definir trigger de migração do `docs/backlog.md` para issue tracker.
13. Tornar instruções de raiz agnósticas de IA, se múltiplos agentes forem realmente utilizados.

---

## P2 — apenas quando houver escala organizacional

14. Context manifest machine-readable.
15. Automação de seleção de read sets.
16. Knowledge graph/retrieval mais sofisticado.

Não implementar P2 agora.

---

# 22. Modelo conceitual final

A estratégia atual já resolve muito bem:

```text
Canonicality
```

O próximo salto de maturidade é combinar:

```text
Canonicality
     +
Routing
     +
Lifecycle
     +
Verification
```

O sistema de contexto ideal precisa saber:

```text
onde a verdade vive
        +
qual verdade carregar para cada tarefa
        +
quando essa verdade deixa de ser válida
        +
como provar que ela ainda corresponde à realidade
```

---

# 23. Veredito final

A estratégia de contexto já é muito madura.

O maior mérito é não tratar documentação como armazenamento passivo, mas como um sistema explícito de:

```text
authority
location
evolution
auditability
```

As principais melhorias recomendadas não exigem plataformas sofisticadas nem ferramentas adicionais complexas.

Elas reforçam propriedades estruturais que ficam caras de corrigir mais tarde:

```text
single active architecture
immutable ADR history
domain vocabulary
context routing
authority matrix
ephemeral-context discipline
automated structural checks
```

O objetivo deve permanecer:

> Construir uma base de contexto simples hoje, previsível para humanos e agentes e capaz de crescer sem transformar o repositório em um depósito de versões, resumos concorrentes e documentos sem autoridade clara.

Com as mudanças P0 implementadas, a estratégia se aproxima de uma base de engenharia de contexto realmente **world-class**, sem violar o próprio princípio de evitar sofisticação prematura.
