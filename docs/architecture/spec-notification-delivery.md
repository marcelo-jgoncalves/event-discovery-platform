# Notification Delivery Design

## 1. Objetivo

Especificar o pipeline de entrega de notificações do MVP via Telegram com rigor operacional suficiente para:

- não exceder limites do provider por design;
- evitar retry storms;
- aplicar prioridade e políticas de fadiga antes da entrega;
- manter idempotência;
- produzir SLOs mensuráveis;
- permitir novos canais sem redesenho do core.

Princípio central:

> Provider throughput is a domain constraint, not merely an infrastructure error condition.

---

# 2. Escopo

Canal implementado na V1:

```text
Telegram private chat
```

Preparados por abstração, mas fora da implementação inicial:

```text
Email
WhatsApp
Mobile Push
```

O pipeline começa após o matcher produzir um `NotificationCandidate`.

---

# 3. Limites reais do Telegram

Telegram documenta para bots:

```text
Single chat:
avoid > 1 message/second
short bursts may pass, then 429

Group:
<= 20 messages/minute

Bulk broadcast:
~30 messages/second by default
```

Paid Broadcasts podem elevar o limite de broadcast, mas não fazem parte do MVP.

Decisão operacional V1:

```text
Configured global safe rate = 28 msg/s
```

Razão:

```text
30 msg/s provider guideline
- safety margin
= 28 msg/s internal ceiling
```

Per-chat ceiling:

```text
1 msg/s
```

Grupo:

```text
20 msg/minute
```

Mesmo que o MVP use private chats, o limiter deve receber `chatType` para não embutir a hipótese de private chat no core.

---

# 4. Runtime validation dos limites

Rate limits não devem existir apenas em configuração estática.

Registrar continuamente:

```text
provider configured rate
actual accepted send rate
429 frequency
retry_after distribution
per-chat throttle count
```

Se `telegram_429_count` aumentar mesmo abaixo de 28 msg/s:

```text
reduce configured global rate automatically/manual config
```

Configuração:

```text
TELEGRAM_GLOBAL_RATE_PER_SEC=28
TELEGRAM_GLOBAL_BUCKET_CAPACITY=28
TELEGRAM_PRIVATE_CHAT_RATE_PER_SEC=1
TELEGRAM_PRIVATE_CHAT_BUCKET_CAPACITY=1
TELEGRAM_GROUP_RATE_PER_MIN=20
```

Esses valores são configuração operacional, não constantes espalhadas no código.

---

# 5. Pipeline V1

```text
Matcher
   ↓
Notification Candidate
   ↓
Notification Planner
   │
   ├── apply NotificationPolicy
   ├── deduplicate
   ├── determine priority
   ├── determine channel
   └── determine deliverAfter
   ↓
   immediate? ─────────────── no ──────► Deferred Notification Store
       │                                      │
      yes                                     │ scheduled releaser
       │                                      ▼
       └──────────────────────────────► Priority SQS Queues
                                          │
                         ┌────────────────┼────────────────┐
                         ▼                ▼                ▼
                notification-high notification-normal notification-low
                         │                │                │
                         └────────────────┼────────────────┘
                                          ▼
                                Telegram Dispatcher
                                          │
                                   Shared Rate Limiter
                                          │
                                   Telegram Bot API
                                          │
                                          ▼
                                         User
```

---

# 6. NotificationCandidate contract

Exemplo:

```json
{
  "eventType": "notification.requested.v1",
  "notificationId": "ntf_01J...",
  "correlationId": "01J...",
  "userId": "usr_123",
  "canonicalEventId": "evt_456",
  "triggerType": "PRESALE_OPEN",
  "match": {
    "score": 100,
    "reason": "EXACT_WORK"
  },
  "requestedAt": "2026-08-11T20:00:00Z"
}
```

O matcher não precisa conhecer:

```text
Telegram token
Telegram rate limits
Telegram API payload
```

---

# 7. Notification Planner

Responsabilidades:

```text
Load user/channel policy
Check user/channel enabled state
Apply minScore
Apply daily limit
Apply quiet hours
Resolve priority
Create idempotency record
Persist notification state
Route immediate or deferred
```

Não envia mensagens.

---

# 8. NotificationPolicy

Modelo V1:

```json
{
  "channel": "TELEGRAM",
  "enabled": true,
  "timezone": "America/Sao_Paulo",
  "quietHours": {
    "enabled": true,
    "start": "22:00",
    "end": "08:00"
  },
  "dailyLimit": 3,
  "minScore": 70
}
```

Defaults V1:

```text
quietHours   22:00-08:00 local user timezone
dailyLimit   3 non-critical notifications/day
minScore     70
```

Exceção configurável:

```text
P0 PRESALE_OPEN may bypass dailyLimit
but does NOT bypass explicit opt-out
```

V1 recommendation:

```text
P0 can bypass daily limit only if user opted into urgent sale alerts.
```

---

# 9. Ordem de aplicação da policy

```text
1. user active?
2. channel enabled?
3. user opted out of this target/event?
4. score >= minScore?
5. duplicate?
6. daily limit?
7. quiet hours?
8. resolve priority
9. enqueue/defer
```

Essa ordem evita consumir rate-limit capacity com mensagens que seriam descartadas.

---

# 10. Quiet hours

SQS `DelaySeconds` não é usado para quiet hours longas.

Motivo:

```text
SQS delay is bounded and is not a general-purpose long-delay scheduler.
```

Se a mensagem estiver dentro de quiet hours:

```text
status = DEFERRED

deliverAfter = next allowed local time converted to UTC
```

Persistir em `NotificationTable` com bucket temporal:

```text
deliveryBucket = YYYYMMDDHHmm
```

Um scheduled releaser executa periodicamente e envia notificações vencidas para a fila de prioridade correta.

EventBridge Scheduler pode ser usado para acionar esse releaser; isso não reintroduz EventBridge como domain bus e não viola a decisão SQS-first.

---

# 11. Prioridades

## P0 — Critical actionable

```text
PRESALE_OPEN for explicitly followed target
```

Queue:

```text
notification-high
```

## P1 — Exact explicit interest

```text
EXACT_WORK
high-confidence exact PERSON
```

Queue:

```text
notification-high
```

## P2 — Related explicit interest

```text
DIRECTOR/PERSON relation
related franchise
```

Queue:

```text
notification-normal
```

## P3 — Broad relevance

```text
CATEGORY
recommendation
digest
```

Queue:

```text
notification-low
```

V1 may not generate recommendation/semantic P3, but queue semantics are defined now.

---

# 12. Scheduling policy entre filas

Não usar:

```text
always drain HIGH completely before NORMAL
```

Isso pode causar starvation.

V1 adota weighted priority with borrowing.

Target share of dispatch opportunities:

```text
HIGH    70%
NORMAL  20%
LOW     10%
```

Regras:

```text
1. HIGH has reserved preference.
2. NORMAL and LOW are never permanently starved.
3. Unused quota can be borrowed by higher/lower queues.
4. All queues consume the same provider-global rate budget.
```

Implementação V1 simplificada:

```text
separate SQS event source mappings
+
per-priority maximum concurrency
+
shared distributed rate limiter
```

Essa política é aproximada, não uma garantia matemática de 70/20/10 por segundo.

Se fairness precisar ser estrita, migrar para dispatcher scheduler centralizado somente após evidência.

---

# 13. SQS queues

```text
notification-high
notification-normal
notification-low
```

Cada uma possui DLQ própria:

```text
notification-high-dlq
notification-normal-dlq
notification-low-dlq
```

Queue type:

```text
Standard SQS
```

Motivo:

- alto throughput;
- ordering global não é requisito;
- idempotência já é obrigatória;
- prioridade é representada por filas separadas.

---

# 14. Batch size

Delivery event source mappings:

```text
batchSize = 1
```

V1.

Motivo:

- rate limit por mensagem;
- tratamento de `retry_after` individual;
- falhas isoladas;
- sem complexidade de partial batch failure no primeiro release.

Trigger para aumentar batch:

```text
Lambda/SQS overhead becomes measurable cost bottleneck
AND per-message semantics remain safe
```

---

# 15. Concurrency control — MVP

Um único código de dispatcher pode ser usado por três event source mappings.

Valores iniciais:

```text
Lambda reservedConcurrency = 8

HIGH maximumConcurrency   = 4
NORMAL maximumConcurrency = 2
LOW maximumConcurrency    = 2
```

Soma:

```text
4 + 2 + 2 = 8
```

Por que 8:

Se uma chamada ao Telegram tiver aproximadamente 250-300 ms de tempo médio de ponta a ponta:

```text
8 / 0.30 ~= 26.7 attempts/s
```

próximo, mas abaixo, do ceiling interno de 28 msg/s.

O rate limiter continua sendo a autoridade; concurrency é apenas o primeiro guardrail.

---

# 16. Concurrency control — Growth

Valores iniciais para 100k users:

```text
Lambda reservedConcurrency = 12

HIGH maximumConcurrency   = 6
NORMAL maximumConcurrency = 4
LOW maximumConcurrency    = 2
```

Soma:

```text
12
```

Esse aumento NÃO aumenta o ceiling do Telegram.

Ele fornece headroom para:

- latência HTTP variável;
- retries controlados;
- filas simultâneas;
- token waiting.

O shared limiter continua limitando:

```text
accepted send attempts <= 28/s
```

Provisioned concurrency:

```text
not required in MVP
```

---

# 17. Relação entre reservedConcurrency e maximumConcurrency

Regra:

```text
reservedConcurrency >= sum(maximumConcurrency of queue mappings)
```

para evitar competição e throttling interno previsível.

Valores são Terraform variables por ambiente.

Nunca permitir event source mappings sem `maximumConcurrency` explícito no dispatcher.

---

# 18. Shared Global Token Bucket

O rate limiter precisa funcionar entre múltiplas execuções Lambda concorrentes.

Logo:

```text
in-memory limiter alone is invalid
```

V1 usa estado distribuído em DynamoDB.

## Global bucket

Configuração:

```text
capacity     = 28 tokens
refillRate   = 28 tokens/second
cost/send    = 1 token
```

Key conceitual:

```text
RATE#TELEGRAM#BOT#<botId>
```

A aquisição deve ser atômica.

Se não houver token:

```text
do not call Telegram
requeue/defer briefly
```

---

# 19. Per-chat limiter

Private chat:

```text
capacity     = 1
refillRate   = 1 token/second
```

Key:

```text
RATE#TELEGRAM#CHAT#<chatIdHash>
```

Não armazenar o Telegram chat ID puro em métrica/log.

Group chat:

```text
20 sends / 60 seconds
```

Pode usar sliding/fixed window ou bucket equivalente.

Como o MVP é private-chat-first, group limiting deve ser implementado apenas no provider module se grupos forem habilitados.

---

# 20. Atomic limiter semantics

Pseudofluxo:

```text
1. Acquire global token atomically.
2. Acquire per-chat token atomically.
3. If both granted -> call provider.
4. If chat token denied -> release/compensate global token if implementation supports it,
   or use acquire ordering/short leases that avoid meaningful token leakage.
```

V1 recommendation:

```text
check per-chat not-before first
then acquire global token
```

Como a maioria dos usuários recebe uma única mensagem por burst, contenção per-chat deve ser rara.

---

# 21. Burst behavior

Global bucket capacity = refill rate:

```text
28
```

Isso permite um burst curto de até 28 tokens, mas impede acumular créditos por longos períodos e disparar centenas de mensagens de uma vez.

Não usar:

```text
capacity >> refillRate
```

no MVP.

---

# 22. SQS backpressure

Quando tokens acabam:

```text
messages remain/re-enter SQS
```

O sistema deve preferir:

```text
queue growth
```

em vez de:

```text
provider overload
```

Métrica-chave:

```text
ApproximateAgeOfOldestMessage
```

Essa métrica é o principal sinal de backlog.

---

# 23. 429 handling

Telegram pode responder `429 Too Many Requests` e fornecer `retry_after`.

Classificação:

```text
429 with retry_after = provider backpressure signal
not an application bug
```

Fluxo:

```text
1. Parse retry_after.
2. Record telegram_429_count.
3. Lower/penalize local limiter if repeated.
4. Requeue message with notBefore = now + retry_after + jitter.
5. Acknowledge original message only after durable requeue.
```

Isso evita que SQS `ApproximateReceiveCount` transforme backpressure normal em poison-message DLQ.

---

# 24. 429 não deve causar retry storm

Não fazer:

```text
throw error
Lambda retries immediately
multiple workers retry together
```

Fazer:

```text
provider says wait X
      ↓
durable delayed retry
      ↓
workers continue respecting shared limiter
```

Se `retry_after` exceder o limite de delay direto suportado pelo mecanismo escolhido, persistir como deferred notification com `deliverAfter`.

---

# 25. Quando 429 vira incidente

429 isolado:

```text
expected defensive signal
```

Alerta warning:

```text
> 1% sends return 429 over 5 min
```

Alerta critical:

```text
> 5% over 5 min
OR
p95 retry_after > 30s
OR
queue age exceeds delivery SLO
```

Ação automática opcional:

```text
reduce TELEGRAM_GLOBAL_RATE_PER_SEC from 28 to 24
```

V1 pode exigir mudança manual de configuração; auto-tuning fica fora do MVP.

---

# 26. Tratamento de outros erros

## 4xx não-retryable

Exemplos:

```text
bot blocked by user
invalid chat
bad request caused by permanent payload issue
```

Ação:

```text
mark channel invalid/disabled when applicable
mark notification FAILED_PERMANENT
no retry
```

## 5xx / network explicit failure

```text
exponential backoff + full jitter
max bounded attempts
```

Suggested:

```text
1s
2s
4s
8s
30s
2m
```

Persist retry metadata.

---

# 27. Ambiguous delivery outcome

Existe uma janela impossível de eliminar completamente:

```text
Telegram accepts request
network response is lost
worker cannot know whether send succeeded
```

Telegram `sendMessage` não oferece idempotency key end-to-end para resolver isso.

Logo:

> Exactly-once delivery cannot be guaranteed.

Política V1:

```text
Prefer suppressing duplicate user notifications over aggressive retry of ambiguous outcomes.
```

Se o resultado for verdadeiramente ambíguo após request ter sido enviado:

```text
status = DELIVERY_UNKNOWN
no automatic immediate resend
```

Métrica e amostragem operacional devem acompanhar esse estado.

---

# 28. Idempotência — chave

Chave semântica:

```text
channel
+
userId
+
canonicalEventId
+
notificationType
+
triggerVersion
```

Exemplo:

```text
TELEGRAM#usr_123#evt_456#PRESALE_OPEN#v1
```

Hash:

```text
sha256(...)
```

`notificationId` pode ser derivado ou separado, mas `idempotencyKey` deve ser determinístico.

---

# 29. NotificationTable item

Exemplo:

```json
{
  "PK": "NOTIFICATION#ntf_01JABC",
  "SK": "STATE",
  "idempotencyKey": "sha256:...",
  "userId": "usr_123",
  "channel": "TELEGRAM",
  "canonicalEventId": "evt_456",
  "notificationType": "PRESALE_OPEN",
  "priority": "HIGH",
  "status": "QUEUED",
  "deliverAfter": "2026-08-11T20:00:00Z",
  "attemptCount": 0,
  "createdAt": "2026-08-11T19:59:58Z"
}
```

Deve existir acesso eficiente por `idempotencyKey`; isso pode ser resolvido por:

```text
separate idempotency item in same table
```

preferencialmente a um GSI apenas para esse caso.

Exemplo:

```text
PK = IDEMPOTENCY#<hash>
SK = STATE
notificationId = ntf_...
```

Criado com conditional put.

---

# 30. Idempotency flow

```text
1. Planner computes idempotencyKey.
2. Transaction/conditional Put idempotency item.
3. If already exists -> suppress duplicate candidate.
4. Persist notification state.
5. Enqueue exactly one logical notification.
```

SQS continua sendo at-least-once.

Dispatcher:

```text
loads notification state
ignores terminal SENT/FAILED_PERMANENT/DELIVERY_UNKNOWN when replayed
```

---

# 31. Idempotency TTL

Retention inicial:

```text
30 days after event/notification terminal state
```

Para eventos de longa duração ou recorrentes:

```text
expiresAt = max(eventEndAt + 30d, sentAt + 30d)
```

TTL não define lógica imediata; aplicação verifica timestamps.

---

# 32. Ordering guarantees

SQS Standard não garante ordem global.

Sistema NÃO garante:

```text
all notifications delivered in exact creation order
all users receive at same time
NORMAL always delivered after every HIGH message globally
```

Sistema garante logicamente:

```text
priority preference
per-notification idempotency
policy evaluated before enqueue
no intentional concurrent duplicate for same idempotency key
```

---

# 33. Per-user ordering

V1 não implementa ordered stream por usuário.

Se duas notificações do mesmo usuário forem elegíveis simultaneamente:

```text
order is best-effort
```

Porém:

```text
per-chat limiter prevents >1/s
```

Trigger para per-user ordering formal:

```text
UX demonstrates ordering-dependent semantics
```

Possível evolução:

```text
FIFO queue with MessageGroupId=userId
```

Não implementar antes disso.

---

# 34. Daily limit state

Daily count deve ser timezone-aware.

Key conceitual:

```text
USER#usr_123#DAY#2026-08-11#TZ#America-Sao_Paulo
```

Pode residir em `OperationalStateTable`.

Atomic increment/check deve ocorrer no Planner antes do enqueue.

P0 bypass, quando autorizado, deve ser registrado separadamente para analytics.

---

# 35. Match Latency SLO

Definição:

```text
event detected
→ notification accepted into immediate priority queue
OR persisted as DEFERRED by policy
```

Não inclui provider delivery.

MVP target:

```text
P95 < 60 seconds
P99 < 180 seconds
```

Growth target:

```text
P95 < 120 seconds
P99 < 300 seconds
```

Esses SLOs medem nosso pipeline interno antes do bottleneck Telegram.

---

# 36. Delivery Latency SLO

Definição:

```text
eligible notification queued
→ Telegram accepted send
```

Não contar tempo deliberadamente aguardando quiet hours.

MVP steady-state:

```text
P95 < 60 seconds
P99 < 180 seconds
```

Growth steady-state, sem broadcast burst extremo:

```text
P95 < 5 minutes
P99 < 15 minutes
```

Burst SLO é separado.

---

# 37. Throughput mathematics

At 30 msg/s theoretical Telegram broadcast limit:

```text
10,000 / 30 = 333.3 s = 5.56 min
100,000 / 30 = 3,333.3 s = 55.56 min
```

Com nosso safe ceiling de 28 msg/s:

```text
10,000 / 28 = 357.1 s = 5.95 min
100,000 / 28 = 3,571.4 s = 59.52 min
```

Esses são limites ideais sem:

- network overhead;
- 429;
- retries;
- per-chat conflicts;
- policy deferrals.

---

# 38. Burst Delivery SLO

Para bursts de alta prioridade elegíveis imediatamente:

```text
10k notifications:
95% accepted within <= 8 minutes target

100k notifications:
95% accepted within <= 75 minutes target
```

Esses números incluem margem sobre o mínimo físico de 28 msg/s.

Se o negócio exigir 100k mensagens em poucos minutos:

```text
Telegram free broadcast limit is no longer compatible with product requirement.
```

Trigger:

- evaluate Paid Broadcasts;
- split channels;
- change delivery promise.

---

# 39. Queue age SLO

Critical metric:

```text
ApproximateAgeOfOldestMessage
```

HIGH:

```text
warning  > 2 min
critical > 8 min MVP
critical > 15 min Growth steady-state
```

NORMAL:

```text
warning  > 10 min
critical > 30 min
```

LOW:

```text
warning  > 30 min
critical > 2 h
```

Burst incidents use burst-specific SLOs.

---

# 40. DLQ policy

DLQ is for poison/permanent processing failures, not normal rate limiting.

Suggested `maxReceiveCount`:

```text
8
```

But 429 path should requeue durably and acknowledge original, avoiding consuming the poison-message budget.

DLQ candidates:

```text
malformed contract
serialization bug
unexpected provider payload bug
persistent 5xx after bounded retry window
internal invariant violation
```

Permanent user/channel 4xx should be terminal state, not DLQ.

---

# 41. Circuit breaker

Provider breaker states:

```text
CLOSED
OPEN
HALF_OPEN
```

Open when:

```text
sustained provider 5xx/error rate threshold exceeded
```

When OPEN:

```text
do not hammer provider
keep/defer notifications durably
```

429 by itself does not open generic failure breaker; it adjusts throttling/backpressure state.

---

# 42. Metrics obrigatórias — planner

```text
notification_candidates_total
notification_suppressed_duplicate
notification_suppressed_min_score
notification_suppressed_daily_limit
notification_deferred_quiet_hours
notification_enqueued_high
notification_enqueued_normal
notification_enqueued_low
```

---

# 43. Metrics obrigatórias — dispatcher

```text
telegram_send_attempts
telegram_send_success
telegram_send_rate
telegram_429_count
telegram_retry_after_seconds
telegram_4xx_permanent
telegram_5xx_count
telegram_network_error
telegram_delivery_unknown
telegram_delivery_latency_ms
telegram_global_throttle
telegram_per_chat_throttle
telegram_rate_token_wait_ms
```

---

# 44. Metrics obrigatórias — queues

AWS + custom:

```text
ApproximateNumberOfMessagesVisible
ApproximateAgeOfOldestMessage
NumberOfMessagesSent
NumberOfMessagesReceived
NumberOfMessagesDeleted
DLQ depth
queue-by-priority backlog
```

---

# 45. Dashboard V1

Painéis:

## Delivery health

```text
send rate
success rate
429 rate
5xx rate
unknown outcomes
```

## Backlog

```text
HIGH queue depth + age
NORMAL queue depth + age
LOW queue depth + age
DLQs
```

## Rate limiter

```text
global tokens denied
per-chat denied
effective sends/sec
configured ceiling
```

## Product policy

```text
candidates
suppressed
quiet-hour deferred
daily-limit suppressed
priority distribution
```

---

# 46. Alarmes V1

Critical:

```text
HIGH DLQ > 0
HIGH queue age > critical threshold
Telegram success rate < 95% for 5 min excluding expected throttle requeues
Telegram 5xx > 5% for 5 min
notification planner errors > 1%
```

Warning:

```text
429 > 1% for 5 min
rate limiter denial sustained > 80% for 10 min
NORMAL/LOW queue age above warning
DELIVERY_UNKNOWN > 0.1%
```

---

# 47. Correlation and tracing

Cada mensagem carrega:

```text
correlationId
notificationId
canonicalEventId
userIdHash
priority
provider
```

Nunca logar:

```text
bot token
raw chat ID
email/phone
full PII payload
```

---

# 48. Provider abstraction

Interface conceitual:

```typescript
interface NotificationProvider {
  providerId(): ProviderId;
  validateChannel(channel: UserChannel): Promise<ValidationResult>;
  send(request: ProviderSendRequest): Promise<ProviderSendResult>;
  classifyError(error: unknown): ProviderError;
}
```

Provider-specific:

```text
payload format
credentials
rate limits
retry_after parsing
provider error mapping
```

Generic:

```text
NotificationPolicy
priority
idempotency
notification lifecycle
SQS backpressure
tracking
metrics contract
```

---

# 49. Notification lifecycle

Estados V1:

```text
PLANNED
DEFERRED
QUEUED
DISPATCHING
SENT
RETRY_SCHEDULED
FAILED_PERMANENT
DELIVERY_UNKNOWN
SUPPRESSED
```

Transitions devem ser condicionais.

Exemplo:

```text
QUEUED -> DISPATCHING
```

somente se estado atual ainda for `QUEUED`/retry-eligible.

Isso reduz races em reprocessamento SQS.

---

# 50. Provider send result

```typescript
type ProviderSendResult =
  | { status: 'ACCEPTED'; providerMessageId?: string }
  | { status: 'THROTTLED'; retryAfterSeconds: number }
  | { status: 'RETRYABLE_FAILURE'; code: string }
  | { status: 'PERMANENT_FAILURE'; code: string }
  | { status: 'UNKNOWN'; code?: string };
```

O core não precisa entender HTTP 429 diretamente.

---

# 51. Migração para Email

Reutiliza:

```text
Notification Planner
NotificationPolicy
idempotency
priority model
notification lifecycle
tracking
metrics conventions
```

Novo:

```text
EmailProvider
email-specific queue/dispatcher
provider-specific limiter/bounce handling
```

Não reutilizar automaticamente o rate limiter do Telegram.

---

# 52. Migração para WhatsApp

Reutiliza:

```text
planner
idempotency
priority
tracking
notification state
```

Provider-specific:

```text
template approval
conversation/message category constraints
Meta rate limits
opt-in requirements
pricing rules
error taxonomy
```

WhatsApp deve ter seu próprio dispatcher e limiter.

---

# 53. Migração para Mobile Push

Reutiliza:

```text
planner
policy
priority
idempotency
tracking
```

Provider-specific:

```text
FCM/APNs tokens
invalid-token lifecycle
batch semantics
provider quotas
```

---

# 54. Channel routing future

O Planner pode futuramente produzir:

```text
notification.delivery.requested.v1
```

com:

```json
{
  "notificationId": "ntf_...",
  "channel": "TELEGRAM",
  "priority": "HIGH",
  "deliverAfter": "..."
}
```

Na V1, isso trafega diretamente para SQS.

Se houver múltiplos consumers/fan-out real no futuro, EventBridge pode ser introduzido sem alterar o contrato semântico.

---

# 55. Security

Bot token:

```text
AWS Secrets Manager
```

Dispatcher role:

```text
read Telegram secret
read/update NotificationTable
read/write rate-limit state
consume only assigned queues
write logs/metrics
```

Não permitir:

```text
Catalog writes
Users PII bulk reads
admin operations
```

---

# 56. Data privacy

Rate limiter usa:

```text
chatIdHash
```

Logs usam:

```text
userIdHash
```

NotificationTable pode precisar de opaque `userId`, mas canal/endereço deve ser recuperado de storage apropriado e minimizado.

Retenção de delivery logs deve ser definida por privacy policy.

---

# 57. Failure scenarios obrigatórios

Testar:

```text
Telegram returns 429 with retry_after
Telegram returns 500
Telegram timeout before response
user blocks bot
high queue receives 10k burst
all three queues have backlog
rate limiter store throttles
Lambda crashes after provider accepted send
quiet hours release creates burst at 08:00
same candidate produced twice
```

---

# 58. Quiet-hours thundering herd

Às 08:00 muitos usuários podem se tornar elegíveis simultaneamente.

Mitigação V1:

```text
Deferred releaser adds deterministic jitter within configurable window
```

Default:

```text
0-120 seconds for NORMAL/LOW
0-30 seconds for HIGH if not time-critical
P0 presale urgent: no artificial jitter once quiet hours end
```

Todos ainda passam pelo shared provider limiter.

---

# 59. Cost behavior

O limiter deliberadamente mantém Lambda/SQS backlog em vez de aumentar chamadas ao provider.

Principais cost drivers:

```text
Lambda invocation duration while waiting
DynamoDB limiter operations
SQS retries/requeues
CloudWatch logs
```

Regra importante:

> Worker não deve dormir por segundos aguardando token.

Se token não estiver disponível:

```text
requeue/defer
return
```

Isso reduz billed duration e evita consumir concurrency ociosa.

---

# 60. Limiter storage cost/throughput

Global limiter em DynamoDB recebe aproximadamente:

```text
<= 28 successful acquisitions/s
```

mesmo em pico, muito abaixo do envelope normal de uma partition física.

Per-chat limiter distribui keys por chat hash.

Logo:

```text
global limiter key is intentionally hot but bounded by provider limit
```

e é aceitável na V1.

Se novos canais permitirem milhares de sends/s, cada provider terá limiter próprio; não ampliar esse mesmo hot key genericamente.

---

# 61. O que fica fora do MVP

Não implementar agora:

```text
Telegram Paid Broadcasts
automatic dynamic rate tuning
strict weighted-fair scheduler
per-user FIFO ordering
multi-bot sharding
multi-region dispatch
exactly-once provider delivery
cross-channel fallback orchestration
campaign batching
advanced digest composition
ML send-time optimization
provider cost optimizer
```

---

# 62. Triggers de evolução

## Paid Broadcasts / higher Telegram throughput

Quando:

```text
high-priority burst routinely violates business delivery SLO
AND user volume/revenue justifies cost
```

## Strict priority scheduler

Quando:

```text
LOW/NORMAL starvation or HIGH latency cannot be controlled by current concurrency weights
```

## Multiple bots/shards

Somente se:

```text
allowed by Telegram terms/use case
AND single-bot throughput becomes business bottleneck
```

Não assumir que múltiplos bots são mecanismo aceitável para contornar provider limits.

## FIFO per user

Quando:

```text
product semantics become order-dependent
```

## Multi-channel fallback

Quando:

```text
second production channel exists
AND fallback improves measured delivery outcome
```

---

# 63. Terraform requirements

Filas:

```text
notification-high
notification-normal
notification-low
```

Cada uma:

```text
DLQ configured
redrive policy
server-side encryption
CloudWatch alarms
```

Lambda dispatcher:

MVP:

```text
reserved_concurrent_executions = 8
```

Event source mappings:

```text
HIGH   maximum_concurrency = 4
NORMAL maximum_concurrency = 2
LOW    maximum_concurrency = 2
batch_size = 1
```

Growth variables:

```text
reserved = 12
HIGH = 6
NORMAL = 4
LOW = 2
```

Valores devem ser variáveis, não hardcoded em módulos genéricos.

---

# 64. Acceptance criteria

O design está corretamente implementado quando:

```text
[ ] duplicate candidate results in one logical notification
[ ] global send rate never intentionally exceeds configured ceiling
[ ] same chat does not intentionally exceed per-chat ceiling
[ ] 429 uses retry_after and does not create immediate retry storm
[ ] HIGH has measurably lower queue age than NORMAL/LOW under contention
[ ] LOW is not permanently starved
[ ] quiet-hours notifications are not enqueued for immediate delivery
[ ] SQS duplicate delivery does not produce duplicate logical send attempt
[ ] malformed messages reach DLQ after bounded attempts
[ ] permanent Telegram channel errors disable/fail without retry loop
[ ] queue-age alarms fire in load test
[ ] 10k burst remains within calculated throughput envelope
```

---

# 65. Decisões finais

```text
Telegram safe ceiling            28 msg/s
Private chat ceiling              1 msg/s
Queue type                        SQS Standard
Priority queues                   HIGH / NORMAL / LOW
Scheduling                        weighted preference with borrowing
Batch size                        1
MVP Lambda reserved concurrency   8
MVP ESM max concurrency           4 / 2 / 2
Growth reserved concurrency       12
Growth ESM max concurrency        6 / 4 / 2
Rate limiter                      distributed provider-aware token bucket
429                               durable delayed retry using retry_after
DLQ                               poison/permanent processing failures, not normal throttle
Ordering                          best-effort, no global/per-user guarantee
Exactly-once                      not guaranteed end-to-end
Ambiguous provider outcome        prefer duplicate suppression
Quiet hours                       defer before priority queue
```

---

# 66. ADRs recomendados

```text
ADR-005 — Notification Priority and Provider Rate Limiting

ADR-014 — Telegram Safe Throughput Ceiling and Runtime Validation

ADR-015 — Priority Queue Scheduling Strategy

ADR-016 — SQS/Lambda Concurrency Limits for Telegram Dispatcher

ADR-017 — Notification Idempotency and Ambiguous Delivery Semantics

ADR-018 — Quiet Hours and Deferred Notification Scheduling

ADR-019 — Provider-specific Dispatcher Boundary for Multi-channel Evolution
```

---

# 67. Fontes técnicas verificadas

- Telegram — Bots FAQ / rate limits: https://core.telegram.org/bots/faq
- Telegram — Bot API: https://core.telegram.org/bots/api
- AWS — Using Lambda with SQS: https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html
- AWS — Configuring scaling behavior for SQS event source mappings: https://docs.aws.amazon.com/lambda/latest/dg/services-sqs-scaling.html
- AWS — SQS ScalingConfig / MaximumConcurrency: https://docs.aws.amazon.com/lambda/latest/api/API_ScalingConfig.html
- AWS — Lambda concurrency: https://docs.aws.amazon.com/lambda/latest/dg/lambda-concurrency.html
- AWS — DynamoDB partition-key best practices: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-partition-key-design.html
- AWS — DynamoDB TTL: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/TTL.html

