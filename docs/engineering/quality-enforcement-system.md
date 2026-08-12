---
status: active
owner: architecture
authority: normative
---

# Quality Enforcement System — Event Discovery Platform

> Elaboração de `quality-strategy.md` §14 (regra constitucional de enforcement independente), adotada em ADR-011. Este documento é a referência detalhada do *como*; `quality-strategy.md` continua sendo a fonte única sobre o que "qualidade" significa aqui. A implementação concreta das camadas abaixo é incremental — ver `docs/backlog.md` para o que já existe vs. o que está condicionado ao primeiro código do módulo correspondente (ADR-011, trigger de revisão).

## Objetivo

Este documento transforma a estratégia de qualidade do projeto em um sistema de **enforcement independente da IA**.

Princípio central:

> **A IA pode produzir código. A IA não pode ser a autoridade que decide se o código está conforme.**

Nenhum requisito crítico de qualidade deve depender exclusivamente de:

- instrução para IA;
- documentação;
- revisão manual;
- code review;
- memória de quem implementou.

Sempre que possível, requisitos devem virar:

```text
Rule
 ↓
Executable Check
 ↓
CI / Audit
 ↓
Objective Evidence
```

---

# 1. Princípio de enforcement

Regra fundamental:

> **Se uma regra puder ser verificada deterministicamente, ela não deve depender de revisão humana ou IA.**

Exemplos de regras que devem possuir enforcement automático:

```text
No wildcard IAM
No DynamoDB Scan
No raw chatId in logs
No public Lambda Function URLs
GitHub Actions pinned by SHA
Secrets never committed
Terraform mandatory
Provider calls only through adapters
Telegram calls only through dispatcher
Critical SQS queues must have DLQ
PII never enters InterestIndexTable
```

---

# 2. Quatro níveis independentes de proteção

A base deve ser:

```text
                 AI / Developer
                       │
                       ▼
                CODE / TERRAFORM
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
  Static Policy   Architecture    Behavior
     Gates           Tests          Tests
        │              │              │
        └──────────────┼──────────────┘
                       ▼
                  REQUIRED CI
                       │
                  cannot merge
                       │
                       ▼
                    DEPLOY
                       │
                       ▼
             Reality / Drift Audits
                       │
                       ▼
              Scheduled Audits
```

Cada camada responde a uma pergunta diferente.

## Static Policy Gates

```text
"O código viola alguma regra proibida?"
```

## Architecture Fitness Functions

```text
"A estrutura do sistema continua respeitando nossos boundaries?"
```

## Behavior Tests

```text
"O sistema ainda se comporta corretamente?"
```

## Reality Audits

```text
"O que está realmente rodando continua de acordo com código,
infraestrutura e documentação?"
```

---

# 3. Estrutura sugerida

```text
quality/
├── policies/
│   ├── code/
│   ├── architecture/
│   ├── terraform/
│   ├── github/
│   └── documentation/
│
├── tests/
│   ├── fixtures/
│   │   ├── valid/
│   │   └── invalid/
│   └── policy-tests/
│
├── audits/
│   ├── github/
│   ├── aws/
│   ├── application/
│   └── context/
│
└── scripts/
    ├── quality-check.ts
    ├── architecture-check.ts
    ├── drift-check.ts
    └── audit.ts
```

Comando central:

```bash
npm run quality:check
```

---

# 4. Custom Semgrep Rules

Criar regras específicas do projeto.

Exemplos:

```text
EDP001 — DynamoDB Scan forbidden
EDP002 — raw chatId logging forbidden
EDP003 — direct Telegram API call outside provider forbidden
EDP004 — unsafe outbound redirect forbidden
EDP005 — wildcard IAM construction forbidden
EDP006 — direct provider payload use outside connector forbidden
EDP007 — dangerous HTML rendering without sanitizer forbidden
```

Exemplo:

```typescript
console.log(chatId)
```

deve gerar:

```text
EDP002
HIGH

Raw Telegram chat identifier must not be logged.

Use chatIdHash.
```

Fluxo:

```text
Semgrep
  ↓
finding EDP002
  ↓
exit 1
  ↓
PR blocked
```

---

# 5. Policy as Code para Terraform

`terraform validate` não é suficiente para garantir políticas arquiteturais.

Pipeline:

```text
Terraform
   ↓
terraform plan
   ↓
JSON
   ↓
Policy Engine
```

Usar OPA/Rego ou mecanismo equivalente.

Exemplos:

```text
POL-IAM-001
DENY IAM Action="*" Resource="*"

POL-DDB-001
PITR mandatory in prod

POL-SQS-001
Every critical queue must have DLQ

POL-LAMBDA-001
Public Function URL forbidden

POL-LOG-001
Log retention must be explicitly configured

POL-TAGS-001
Required project tags

POL-SECRETS-001
Provider credentials must come from Secrets Manager
```

---

# 6. Testar as próprias políticas

Não basta existir uma regra.

É necessário provar que ela realmente detecta a violação.

Estrutura:

```text
quality/tests/fixtures/

invalid/
  wildcard-iam.tf
  lambda-public-url.tf
  unpinned-action.yml
  raw-chat-id-log.ts
  dynamodb-scan.ts
  hardcoded-secret.ts

valid/
  least-privilege-iam.tf
  safe-telegram-log.ts
  dynamodb-query.ts
```

Fluxo esperado:

```text
wildcard-iam.tf
     ↓
policy engine
     ↓
MUST FAIL
```

Caso uma fixture inválida passe:

```text
EXPECTED FAILURE
but got SUCCESS
```

o teste do próprio controle falha.

---

# 7. Control Integrity Tests

Nome sugerido para essa classe de testes:

> **Control Integrity Tests**

Exemplo:

```text
Control:
"No DynamoDB Scan"

Positive fixture:
QueryCommand
→ PASS

Negative fixture:
ScanCommand
→ MUST FAIL
```

Outro:

```text
Control:
"GitHub Actions must be SHA pinned"

uses:
  actions/checkout@v4
→ MUST FAIL

uses:
  actions/checkout@<40-char-sha>
→ PASS
```

Outro:

```text
Control:
"No raw PII in logs"

logger.info({ chatId })
→ MUST FAIL

logger.info({ chatIdHash })
→ PASS
```

Princípio:

> **Não apenas verificamos conformidade; verificamos que o mecanismo de conformidade continua funcionando.**

---

# 8. Architecture Fitness Functions

Decisões arquiteturais importantes devem virar testes permanentes.

## Matcher não acessa PII

```text
services/matching
      │
      X── cannot import packages/users/pii
```

Exemplo proibido:

```typescript
import { getUserEmail } from "../users/pii";
```

Resultado:

```text
architecture-test ❌
```

---

## Ticketmaster isolado em connector

```text
Ticketmaster API
      ↑
ONLY connectors/ticketmaster/
```

Código em:

```text
services/matching/
```

não pode chamar Ticketmaster diretamente.

---

## Telegram isolado no provider

```text
Telegram SDK / HTTP
       ↑
ONLY notifications/providers/telegram
```

Exemplo proibido:

```typescript
fetch("https://api.telegram.org/...")
```

fora do provider.

---

# 9. Regras de arquitetura devem virar propriedades testáveis

Exemplo de regra:

```text
"PII never enters InterestIndexTable"
```

deve virar teste.

Campos proibidos:

```text
email
phone
chatId
name
```

Exemplo:

```typescript
it("InterestIndex items never contain PII fields")
```

A regra deixa de ser apenas Markdown e se torna uma propriedade executável do sistema.

---

# 10. Behavior Tests

Nem toda regra pode ser detectada estaticamente.

Exemplo:

> Uma notificação duplicada nunca pode chegar duas vezes ao provider.

Teste:

```text
same NotificationCandidate × 2
        ↓
dispatcher
        ↓
provider called exactly once
```

Outros testes críticos:

```text
User follows Christopher Nolan
→ new Interstellar screening in Belo Horizonte
→ exactly one notification
```

```text
User follows Interstellar with locationScope=ANY
→ event in any city matches
```

```text
Telegram 429 with retry_after
→ durable retry
→ no immediate retry storm
```

```text
Global token bucket exhausted
→ messages remain in SQS
→ zero excess provider calls
```

---

# 11. Requisitos críticos identificados

Cada requisito crítico deve possuir ID.

Exemplo:

```text
REQ-NOT-001
A NotificationCandidate with an existing
idempotencyKey must never reach the provider twice.
```

Teste correspondente:

```text
REQ-NOT-001.test.ts
```

Traceability:

```text
Requirement
   ↓
Test
   ↓
CI
```

---

# 12. Quality Rule Registry

Criar:

```text
docs/engineering/quality-rules.md
```

Esse documento deve funcionar como registry, não como prosa longa.

Exemplo:

| ID | Regra | Enforcement | Gate |
|---|---|---|---|
| QR-001 | No DynamoDB Scan | Semgrep | PR |
| QR-002 | No wildcard IAM | OPA | PR |
| QR-003 | Telegram only via provider | architecture test | PR |
| QR-004 | No raw PII logs | Semgrep | PR |
| QR-005 | Critical SQS queue requires DLQ | OPA | PR |
| QR-006 | No duplicate notification | E2E | PR |
| QR-007 | Branch protection enabled | reality audit | Weekly |
| QR-008 | GuardDuty enabled | AWS audit | Weekly |
| QR-009 | IaC matches AWS | drift audit | Nightly |

Para toda regra deve ser possível responder:

> **Quem garante isso?**

Se a resposta for:

```text
"Claude should remember"
```

a regra não possui enforcement suficiente.

---

# 13. Auditoria contra estado real

Criar:

```bash
npm run audit:reality
```

Essa auditoria consulta:

```text
GitHub API
AWS APIs
deployed endpoints
```

Exemplos de validações:

```text
Branch protection really enabled?
Required checks really required?
GuardDuty actually enabled?
CloudTrail actually running?
PITR actually enabled?
Lambda concurrency really configured?
SQS DLQ really attached?
No public Lambda URLs?
Cognito configuration correct?
Log retention correct?
```

Objetivo:

detectar situações como:

```text
Terraform says X
AWS currently has Y
```

---

# 14. Infra Drift Detection

Executar regularmente:

```bash
terraform plan -detailed-exitcode
```

Interpretação:

```text
exit 0 → no drift
exit 2 → change/drift detected
exit 1 → error
```

Criar audit:

```text
audit-infra-drift
```

Cadência recomendada:

```text
nightly
```

Drift inesperado deve gerar:

```text
QUALITY DRIFT INCIDENT
```

e não apenas log.

---

# 15. Auditorias regulares não podem depender do CI de PR

CI valida mudanças.

Ele não garante que ambiente externo ou configuração não tenha degradado.

Cadência recomendada:

| Frequência | Auditoria |
|---|---|
| cada PR | gates + architecture fitness |
| merge main | AWS integration + E2E |
| nightly | infra drift + provider contracts + dependencies |
| semanal | control integrity + GitHub/AWS reality |
| antes de release | E2E + failure + DAST + load |
| mensal | Project Consistency Audit |
| trimestral | AppSec + IAM + DR/restore |

---

# 16. Provider Contract Audit

TMDB e Ticketmaster estão fora do nosso controle.

Criar workflow agendado:

```text
scheduled workflow
      ↓
TMDB known endpoint
Ticketmaster known endpoint
      ↓
real payload
      ↓
connector
      ↓
normalizer
      ↓
schema + invariants
```

Se ocorrer mudança incompatível:

```text
provider_contract_drift = 1
```

e deve ser emitido alerta.

---

# 17. Auditoria semanal dos próprios controles

Uma vez por semana:

```text
quality/control-integrity
```

deve executar todas as fixtures inválidas.

Confirmar:

```text
Semgrep detects violations?
OPA rejects invalid Terraform?
Gitleaks catches fake secret?
architecture tests catch forbidden imports?
GitHub ruleset still requires the correct checks?
```

Princípio:

> **O alarme também é testado.**

---

# 18. Mutation Testing nos hot paths

Adotar posteriormente, apenas em código crítico:

```text
matcher
idempotency
notification policy
rate limiter
```

Exemplo:

Código:

```typescript
if (score >= minimumScore)
```

Mutation:

```typescript
if (score < minimumScore)
```

Se os testes continuarem verdes:

```text
our tests are insufficient
```

Mutation testing é mais útil nesses componentes do que perseguir cobertura percentual genérica.

---

# 19. Incident → Invariant Pipeline

Toda classe relevante de incidente deve fortalecer o sistema de enforcement.

Não basta:

```text
fix code
```

Fluxo:

```text
Incident
   ↓
Why did code allow it?
   ↓
Why did tests allow it?
   ↓
Why did policy allow it?
   ↓
Can this class be automated?
   │
  yes
   ↓
Add enforcement rule
   ↓
Add negative fixture
   ↓
Add regression test
```

Resultado:

> **A qualidade aumenta com os erros.**

---

# 20. Regra pós-incidente

Para incidentes generalizáveis:

```text
1. Fix
2. Regression test
3. Quality rule
4. Control integrity fixture
5. Audit update when applicable
```

Exemplo:

```text
Incident:
AI added ScanCommand

Response:
1. Replace Scan with Query
2. Add regression test
3. Add QR-001
4. Add invalid dynamodb-scan.ts fixture
5. Add weekly control-integrity verification
```

---

# 21. Auditoria adversarial com IA

Pode existir uma segunda IA com função de auditoria:

```text
Implementation AI
       ↓
produces code

Independent Audit AI
       ↓
tries to prove quality violations
```

Mas a IA auditora serve para:

```text
generate hypotheses
find suspicious areas
challenge assumptions
```

Conclusões importantes devem ser confirmadas por:

```text
test
CLI
API
scanner
runtime evidence
```

Nunca considerar suficiente:

```text
"the second AI said it is correct"
```

---

# 22. Evidência obrigatória de auditoria

Finding sugerido:

```yaml
id: PCA-20260811-001
severity: high
confidence: high

rule: QR-003

expected:
  Telegram may only be called through TelegramProvider

observed:
  services/foo/send.ts calls api.telegram.org directly

evidence:
  file: services/foo/send.ts
  line: 81

verification:
  semgrep rule EDP003 reproduced

status: open
```

Finding sem evidência verificável deve ser tratado como:

```text
hypothesis
```

e não como finding confirmado.

---

# 23. Quality Gate Matrix

```text
                      PR   Main  Nightly Weekly Release Quarterly

Typecheck             ✅
Lint                  ✅
Unit                   ✅
Semgrep                ✅
OPA/IaC policies       ✅
Arch fitness           ✅
Contract               ✅

AWS Integration             ✅
E2E                         ✅

Terraform drift                   ✅
Provider canaries                 ✅
Dependency drift                  ✅

Control integrity                         ✅
GitHub rules audit                        ✅
AWS configuration audit                   ✅

Failure tests                                   ✅
Load tests                                      ✅
DAST                                            ✅

Full AppSec                                                ✅
IAM review                                                 ✅
Restore drill                                              ✅
```

Essa matriz deve ser a referência operacional do sistema de qualidade.

---

# 24. Required Status Checks

Gates críticos devem estar configurados como required status checks no GitHub.

Fluxo:

```text
AI PR
 ↓
quality-policy ❌
 ↓
MERGE BLOCKED
```

Nunca depender apenas de comentários:

```text
bot says:
"you should fix X"

→ merge remains possible
```

Para requisitos críticos, isso é insuficiente.

---

# 25. Comandos padrão

## Desenvolvimento local

```bash
npm run verify
```

Responsabilidades:

```text
typecheck
lint
unit
architecture checks
local policy checks
```

---

## CI completo

```bash
npm run quality:check
```

Responsabilidades:

```text
verify
Semgrep
Gitleaks
OPA
Terraform checks
contracts
integration tests
```

---

## Auditoria do projeto

```bash
npm run audit:project
```

Responsabilidades:

```text
GitHub reality
AWS reality
infra drift
provider drift
quality control integrity
context consistency
```

---

# 26. Quality Self-Test

Criar:

```bash
npm run quality:self-test
```

Ele executa deliberadamente fixtures inválidas e exige que os controles as rejeitem.

Exemplo de output:

```text
Quality Control Integrity

QR-001 DynamoDB Scan ........ PASS (violation detected)
QR-002 Wildcard IAM ......... PASS (violation detected)
QR-003 Direct Telegram ...... PASS (violation detected)
QR-004 Raw PII log .......... PASS (violation detected)
QR-005 Unpinned Action ...... PASS (violation detected)

5/5 controls operational
```

Esse comando é uma das peças centrais do sistema.

---

# 27. Processo para toda nova regra de qualidade

Para cada novo requisito:

```text
1. É verificável automaticamente?
   → gate

2. É uma invariável arquitetural?
   → fitness function

3. É comportamento?
   → test

4. Só pode ser comprovado no ambiente real?
   → scheduled audit

5. O controle pode parar de funcionar silenciosamente?
   → control integrity test

6. Nada disso é possível?
   → manual audit checklist + evidence
```

---

# 28. Transformação conceitual

A evolução desejada é:

```text
Quality Strategy
       ↓
Quality Rules
       ↓
Executable Policies
       ↓
Fitness Functions
       ↓
Required Gates
       ↓
Scheduled Reality Audits
       ↓
Control Self-Tests
```

O padrão deixa de ser recomendação.

Ele se torna uma propriedade verificável do sistema de engenharia.

---

# 29. Nova regra constitucional de qualidade

Adicionar à estratégia oficial:

> **No critical quality requirement may rely solely on an AI instruction, code review, or documentation. Every critical requirement must have an independent enforcement or verification mechanism.**

Versão em português:

> **Nenhum requisito crítico de qualidade pode depender exclusivamente de instrução para IA, revisão de código ou documentação. Todo requisito crítico deve possuir um mecanismo independente de enforcement ou verificação.**

---

# 30. Modelo final

A IA continua sendo uma produtora importante de engenharia.

Mas:

```text
AI
 ↓
produces
 ↓
CODE
```

não significa:

```text
AI
 ↓
judges itself
 ↓
APPROVED
```

O modelo correto:

```text
AI / Developer
       ↓
Implementation
       ↓
Independent Controls
       ↓
Objective Evidence
       ↓
Merge / Deploy Decision
```

A meta não é confiar que a IA sempre seguirá o padrão.

A meta é construir um sistema no qual:

> **violar o padrão seja detectado automaticamente sempre que tecnicamente possível, e auditado regularmente contra a realidade quando não for.**
