---
status: superseded
supersededBy: ../architecture.md
authority: historical
---

# Arquitetura do MVP — Plataforma de Descoberta e Notificação de Filmes e Eventos (histórico)

> **Documento histórico.** Superseded por `../architecture.md`. Mantido apenas para contexto de como o desenho evoluiu — não é fonte normativa. Onde este documento e a arquitetura vigente divergem, a arquitetura vigente sempre prevalece.

## 1. Objetivo do projeto

Construir um MVP de alta qualidade, preparado para crescimento e escalabilidade, capaz de notificar usuários quando filmes, eventos, artistas, diretores, franquias, locais ou categorias de interesse se tornarem relevantes e acionáveis em uma determinada cidade.

O foco inicial será Belo Horizonte, com ênfase em filmes, eventos e notificações via Telegram, mas a arquitetura deve permitir evolução futura para:

- novas cidades;
- novas categorias de eventos;
- novos canais de notificação;
- novos provedores de dados;
- afiliados;
- eventos patrocinados;
- planos premium;
- analytics B2B;
- produtores e venues;
- recomendação e personalização com IA;
- expansão internacional.

A arquitetura deve seguir padrões profissionais e "world-class", evitando dois extremos:

1. um MVP descartável que precise ser reescrito quando crescer;
2. uma arquitetura excessivamente complexa para uma aplicação que ainda não validou o mercado.

A regra principal é:

> Build for today's load; design for tomorrow's load.

---

# 2. Princípios arquiteturais

A arquitetura deve seguir estes princípios:

- Serverless-first
- Event-driven
- Asynchronous by default
- API/provider agnostic
- Domain-driven boundaries
- Canonical data model
- Raw-data retention
- Idempotent consumers
- Queues for backpressure
- Observability by design
- Security by design
- Privacy by design
- Infrastructure as Code
- Contracts versioned
- AI as enrichment, not dependency
- Monetization instrumentation from day one
- Multi-city ready
- Internationalization ready
- Progressive scalability

A aplicação não deverá nascer como um conjunto de microservices tradicionais distribuídos. O objetivo inicial é trabalhar com componentes modulares, limites de domínio claros e integração orientada a eventos, permitindo extração futura de serviços independentes quando houver necessidade real.

---

# 3. Visão geral da arquitetura

```text
                           ┌─────────────────────┐
                           │       USERS         │
                           │ Web / Telegram      │
                           └──────────┬──────────┘
                                      │
                             CloudFront / API
                                      │
                         ┌────────────▼────────────┐
                         │      PRODUCT API        │
                         │ API Gateway + Lambda    │
                         └────────────┬────────────┘
                                      │
                   ┌──────────────────┼───────────────────┐
                   │                  │                   │
                   ▼                  ▼                   ▼
             User Service      Interest Service     Event Query
                   │                  │                   │
                   └──────────────────┼───────────────────┘
                                      ▼
                                 DynamoDB
                                      │
──────────────────────────────────────┼─────────────────────────────────

                     EVENT INGESTION PLATFORM

 EventBridge Scheduler
          │
          ▼
 Collector Orchestrator
          │
     ┌────┼───────────────┐
     ▼    ▼               ▼
 Ticketmaster            TMDB        Future Sources
 Connector               Connector   Cineart/Sympla/etc.
     │                    │
     └──────────┬─────────┘
                ▼
         Ingestion Queue
              SQS
                │
                ▼
          Raw Processor
                │
          ┌─────┴─────┐
          ▼           ▼
          S3       Normalizer
                      │
                      ▼
               Entity Resolution
                      │
                      ▼
                Canonical Events
                   DynamoDB
                      │
                      ▼
                EventBridge Bus
                      │
         ┌────────────┼────────────┐
         ▼            ▼            ▼
     Matcher      Analytics    Indexing
         │
         ▼
 Notification Candidate
         │
        SQS
         │
         ▼
 Notification Orchestrator
         │
    ┌────┼───────────────┐
    ▼    ▼               ▼
Telegram Email        WhatsApp*
 Worker  Worker        Worker

*posteriormente
```

---

# 4. Separação de responsabilidades

Os principais subsistemas devem ser independentes:

1. Collection
2. Normalization
3. Entity Resolution
4. Catalog
5. Matching
6. Notification
7. Tracking
8. Analytics
9. AI Enrichment

Não deve existir uma Lambda que:

1. consulta uma API externa;
2. identifica um evento;
3. procura usuários;
4. envia imediatamente notificações.

Cada etapa deve ser desacoplada por eventos e filas.

---

# 5. Arquitetura orientada a eventos

O domínio deve produzir eventos internos versionados.

Exemplo:

```json
{
  "eventType": "catalog.event.discovered.v1",
  "eventId": "01J...",
  "occurredAt": "2026-08-11T12:30:00Z",
  "source": "ticketmaster",
  "correlationId": "01J...",
  "data": {
    "canonicalEventId": "evt_123"
  }
}
```

Fluxo conceitual:

```text
catalog.event.discovered.v1
        ↓
matcher
        ↓
match.created.v1
        ↓
notification.requested.v1
        ↓
notification.sent.v1
        ↓
notification.clicked.v1
```

Eventos futuros podem incluir:

```text
catalog.event.updated.v1
catalog.work.created.v1
catalog.event.enriched.v1
sale.presale.scheduled.v1
sale.presale.opened.v1
interest.created.v1
match.created.v1
notification.requested.v1
notification.sent.v1
notification.failed.v1
notification.clicked.v1
affiliate.redirected.v1
conversion.recorded.v1
```

---

# 6. EventBridge vs SQS

## EventBridge

Usar para eventos de domínio e fan-out.

Exemplo:

```text
EventDiscovered
      │
      ├── Matcher
      ├── Analytics
      ├── Search Indexer
      └── Future Recommendation Engine
```

Casos apropriados:

- eventos de negócio;
- múltiplos consumidores;
- integração desacoplada;
- evolução futura de consumidores.

## SQS

Usar para trabalho que precisa ser processado.

Exemplo:

```text
100.000 notificações
        ↓
       SQS
        ↓
notification workers
```

Benefícios:

- backpressure;
- retries;
- controle de concorrência;
- isolamento de falhas;
- DLQ;
- proteção contra APIs externas lentas.

---

# 7. Connectors como plugins

Cada fonte externa deve obedecer a um contrato.

```typescript
interface EventSourceConnector {
  source(): SourceId;

  collect(
    cursor?: CollectionCursor
  ): Promise<CollectionResult>;
}
```

Implementações iniciais:

```text
TicketmasterConnector
TMDBConnector
```

Futuras:

```text
CineartConnector
SymplaConnector
IngressoConnector
ShotgunConnector
EventimConnector
VenueConnector
```

O domínio nunca deve conhecer detalhes específicos das APIs externas.

Ele recebe uma representação intermediária:

```text
RawSourceEvent
```

---

# 8. Rate limiting por fonte

Cada provider deverá ter configuração independente.

Modelo:

```text
SourceConfiguration

source
enabled
schedule
requestsPerSecond
requestsPerDay
retryPolicy
timeout
circuitBreaker
cursor
lastSuccessfulRun
```

Exemplo:

```yaml
ticketmaster:
  enabled: true
  interval: 15m
  maxRequestsPerSecond: 2
  dailyBudget: 4500
```

Os limites não devem ficar espalhados dentro do código.

---

# 9. Coleta incremental

Nunca consultar o catálogo inteiro repetidamente se não houver necessidade.

Cada connector deve manter:

```text
cursor
watermark
lastSuccessfulRun
```

Quando o provider não fornecer mecanismo incremental:

```text
hash(source_payload)
```

Se o hash for o mesmo:

```text
STOP
```

Se mudar:

```text
Normalize
   ↓
Compare
   ↓
Generate domain events
```

---

# 10. Raw data retention

Todo payload recebido deve poder ser preservado no S3.

Estrutura sugerida:

```text
s3://event-platform-raw-prod/

ticketmaster/
  2026/
    08/
      11/
        <collection-id>.json

tmdb/
  ...
```

Benefícios:

- replay;
- auditoria;
- correção de bugs;
- reconstrução do catálogo;
- desenvolvimento de novos normalizadores;
- base futura de data lake.

Se surgir um bug no normalizador:

```text
RAW DATA
   ↓
reprocess
   ↓
new normalizer
```

Sem precisar consultar novamente o provider.

---

# 11. Anti-Corruption Layer e modelo canônico

Nenhum formato específico de provider deve vazar para o domínio.

Modelo conceitual:

```typescript
CanonicalEvent {
  id
  type

  title
  description

  startAt
  endAt
  timezone

  venueId
  cityId

  performers[]
  categories[]
  tags[]

  workId?

  status

  sale {
    status
    startsAt
    endsAt
  }

  sources[]
  offers[]

  createdAt
  updatedAt
}
```

Nunca espalhar conceitos como:

```text
ticketmasterEventId
```

pelo domínio.

---

# 12. Separação entre WORK e EVENT

Esse é um dos conceitos centrais do domínio.

```text
WORK
Interstellar
```

é diferente de:

```text
EVENT
Interstellar
Cineart Boulevard
22/08
19:30
IMAX
```

Modelo:

```text
Work
 ├── Movie
 ├── Play
 ├── ConcertTour
 └── Franchise

Event
 ├── Screening
 ├── Concert
 ├── Festival
 └── Performance
```

Isso permite que o usuário siga:

```text
Interstellar
```

e receba alertas de qualquer nova sessão.

Também permite seguir:

```text
Christopher Nolan
```

e receber eventos relacionados às obras dele.

---

# 13. Entity Resolution

Subsystem responsável por identificar quando representações diferentes apontam para a mesma entidade.

Entrada:

```text
"INTERSTELLAR IMAX"
"Interstellar - IMAX"
"Interestelar"
```

Saída:

```text
workId = mov_interstellar_2014
confidence = 0.99
```

Estratégia em níveis:

```text
1. deterministic identifiers
2. deterministic rules
3. fuzzy matching
4. AI-assisted matching
```

Priorizar identificadores fortes.

Exemplo:

```text
same TMDB ID
```

→ correspondência determinística.

Depois:

```text
normalized title
+
year
+
director
```

IA somente em casos ambíguos.

---

# 14. DynamoDB como serving layer

Usar DynamoDB como principal banco operacional.

Tabelas ou bounded contexts iniciais:

```text
Users
Interests
Catalog
Subscriptions
Notifications
SourceState
Tracking
Idempotency
```

Evitar single-table design extremo desde o primeiro commit.

Consolidar apenas quando os access patterns estiverem claros.

---

# 15. Access patterns antes das tabelas

Antes de modelar DynamoDB, documentar consultas.

Exemplos:

```text
Get user by ID

Get interests by user

Find users interested in work X

Find users interested in performer X

Find upcoming events by city

Find sessions of work X

Find notification by user/event

Check whether notification was already sent
```

Depois desenhar:

```text
PK
SK
GSI1
GSI2
```

---

# 16. Matching Engine

Nunca implementar:

```text
for each event:
    scan all users
```

Usar índices invertidos.

Exemplo:

```text
INTEREST#WORK#123
    ├── USER#1
    ├── USER#23
    └── USER#884
```

Outro:

```text
INTEREST#PERFORMER#NOLAN
```

Quando chega:

```text
Interstellar screening
```

derivar:

```text
work = Interstellar
director = Nolan
genre = Science Fiction
city = Belo Horizonte
```

e consultar somente usuários candidatos.

A complexidade deixa de ser:

```text
events × users
```

e passa para:

```text
events × candidate_matches
```

---

# 17. Matching V1

Começar determinístico.

Critérios iniciais:

```text
EXACT WORK
EXACT ARTIST
EXACT DIRECTOR
FRANCHISE
VENUE
CATEGORY
CITY
```

Exemplo de score:

```text
explicit work         +100
explicit artist        +80
explicit director      +70
explicit franchise     +60
category               +30
same city              mandatory
```

Exemplo:

```text
User follows:
Christopher Nolan

New event:
Interstellar IMAX
Director: Christopher Nolan

score: 70
→ notify
```

---

# 18. IA fora do caminho crítico

Nunca criar o fluxo principal como:

```text
Event arrives
   ↓
LLM
   ↓
Notification
```

Se o modelo falhar, o produto para.

Fluxo correto:

```text
raw event
   ↓
deterministic normalization
   ↓
catalog
   ↓
notification
```

IA:

```text
ambiguous entities
        ↓
AI enrichment queue
        ↓
enrichment
```

IA deve ser enrichment assíncrono inicialmente.

---

# 19. Notification Platform

Contrato provider-agnostic:

```typescript
interface NotificationProvider {
  send(message: Notification): Promise<SendResult>;
}
```

Providers:

```text
TelegramProvider   ← V1
EmailProvider      ← V1/V1.1
WhatsAppProvider   ← futuro
PushProvider       ← futuro
```

---

# 20. Telegram V1

Telegram será o primeiro canal.

Arquitetura:

```text
Telegram
   ↓
API Gateway
   ↓
Webhook Lambda
   ↓
Command Handler
```

Fluxos:

```text
/start
```

→ associa conta Telegram ao usuário.

Interação inicial pode suportar:

```text
/seguir Interstellar
```

Mas a tendência ideal é:

```text
bot
 ↓
Web App / Mini App
 ↓
interface rica
```

---

# 21. Aplicação web desde o início

Mesmo com Telegram como canal principal, deve existir uma aplicação web.

Frontend sugerido:

```text
Next.js
```

Hospedagem preferencial:

```text
S3 + CloudFront
```

quando possível.

Evitar EKS, ECS ou containers no MVP sem necessidade real.

---

# 22. Identidade e autenticação

Usar Amazon Cognito.

Fluxo:

```text
User
 ↓
Cognito
 ↓
JWT
 ↓
API Gateway
 ↓
API
```

Separar identidade do usuário de canal de comunicação.

```text
User
 ├── email
 ├── Telegram account
 └── WhatsApp account
```

Nunca tratar:

```text
Telegram ID == User ID
```

---

# 23. Tracking e monetização desde o MVP

Nunca enviar diretamente o link final do parceiro.

Enviar:

```text
https://app.com/go/<tracking-token>
```

Fluxo:

```text
Telegram
   ↓
/go/x8Aj
   ↓
Tracking API
   ↓
record Click
   ↓
resolve AffiliateOffer
   ↓
HTTP 302
   ↓
Ticket Provider
```

Isso permite medir:

```text
notification
→ delivered
→ clicked
→ partner
→ eventual conversion
```

---

# 24. Affiliate abstraction

Modelo:

```text
Offer
 ├── provider
 ├── originalUrl
 ├── affiliateUrl
 ├── price
 ├── currency
 ├── availability
 └── commissionModel
```

Providers futuros:

```text
Ticketmaster
Sympla
Ingresso.com
Eventim
Direct Producer
```

Nenhuma regra de negócio deve ficar acoplada a um provider específico.

---

# 25. Idempotência

Obrigatória em toda operação sensível.

Exemplo:

```text
idempotencyKey =
userId + canonicalEventId + notificationType
```

Antes de enviar:

```text
ConditionalWrite DynamoDB

if exists:
    DON'T SEND
```

Evita duplicatas como:

```text
Interstellar disponível
Interstellar disponível
Interstellar disponível
```

---

# 26. Retry strategy

Chamadas externas devem implementar:

```text
short timeout
+
exponential backoff
+
jitter
+
bounded retry
+
DLQ
```

Exemplo Telegram:

```text
Telegram 429
    ↓
retry after
    ↓
SQS visibility
    ↓
worker again
```

Após limite:

```text
DLQ
```

e alarme.

---

# 27. Circuit breaker

Cada source/provider pode ter estado:

```text
CLOSED
OPEN
HALF_OPEN
```

Exemplo:

```text
Provider failing continuously
        ↓
circuit OPEN
        ↓
stop calls temporarily
        ↓
prevent request avalanche
```

---

# 28. Observabilidade

Obrigatória desde a V1.

Stack inicial:

```text
CloudWatch Logs
CloudWatch Metrics
Tracing
Dashboards
Alarms
```

Logs estruturados:

```json
{
  "level": "INFO",
  "service": "notification-worker",
  "correlationId": "...",
  "userIdHash": "...",
  "eventId": "...",
  "provider": "telegram",
  "durationMs": 127
}
```

Evitar logs informais em produção.

---

# 29. Correlation IDs

Todo evento deve carregar correlation ID.

```text
Collector
 correlationId ABC

 ↓

SQS
 ABC

 ↓

Normalizer
 ABC

 ↓

EventBridge
 ABC

 ↓

Matcher
 ABC

 ↓

Notification
 ABC
```

Objetivo:

poder reconstruir toda a cadeia de processamento de um evento ou notificação.

---

# 30. Métricas técnicas e de negócio

## Técnicas

```text
collector_success
collector_failure
queue_depth
dlq_depth
lambda_errors
latency
throttling
provider_errors
normalization_errors
```

## Negócio

```text
events_discovered
events_normalized
events_deduplicated

matches_created

notifications_requested
notifications_delivered
notifications_failed

clicks
CTR

affiliate_clicks
conversions

active_users
active_interests
```

Separar:

```text
technical observability
≠
product analytics
```

---

# 31. SLOs iniciais

Exemplos:

## Ingestion freshness

```text
99% dos eventos detectados
processados em < 10 min
```

## Notification latency

```text
P95:
event detected → notification sent
< 5 min
```

## API

```text
availability ≥ 99.9%
```

## Duplicate notification rate

```text
< 0.01%
```

Esses números podem ser objetivos internos inicialmente.

---

# 32. Segurança

Aplicar least privilege.

Exemplo:

```text
Normalizer Lambda

ALLOW:
dynamodb:PutItem Catalog
s3:GetObject RawBucket

DENY:
Users table
Notification queue
Cognito
```

Evitar:

```text
Action: "*"
Resource: "*"
```

---

# 33. Secrets

Credenciais:

```text
Ticketmaster API Key
Telegram Bot Token
TMDB credentials
```

Armazenar em:

```text
AWS Secrets Manager
```

ou Parameter Store quando apropriado.

Nunca:

```text
.env committed
Terraform variable plaintext
hardcoded secrets
```

---

# 34. VPC

Não colocar Lambdas em VPC inicialmente sem necessidade.

Evitar complexidade prematura com:

```text
subnets
NAT Gateway
route tables
ENIs
```

Se futuramente Aurora/OpenSearch privados forem necessários, rever a decisão.

---

# 35. LGPD by design

Modelo de consentimento:

```text
Consent {
   userId
   purpose
   version
   grantedAt
   source
}
```

Ações obrigatórias:

```text
unsubscribe
export data
delete account
change preferences
withdraw consent
```

Separar PII de analytics.

Nos eventos analíticos:

```text
userId = usr_01H...
```

e não email/telefone.

---

# 36. Analytics e Data Lake

Eventos relevantes podem futuramente fluir para:

```text
EventBridge
   ↓
Firehose / delivery
   ↓
S3
```

Estrutura:

```text
S3
raw/
curated/
analytics/
```

Evolução futura:

```text
Glue
Athena
QuickSight
```

Evitar Redshift/OpenSearch antecipadamente.

---

# 37. Search

No MVP:

```text
TMDB/Ticketmaster search
+
simple catalog indexes
```

Futuro:

```text
EventBridge
   ↓
Search Indexer
   ↓
OpenSearch
```

O domínio não deve depender do mecanismo de busca.

---

# 38. AI Enrichment Pipeline

Pipeline futuro:

```text
event.normalized
      ↓
AI enrichment queue
      ↓
AI worker
      ↓
classification
```

Possíveis outputs:

```text
genres
entities
themes
aliases
relationships
embeddings
```

Evento resultante:

```text
catalog.event.enriched.v1
```

---

# 39. Evolução do matcher

## Fase 1

```text
rules
```

## Fase 2

```text
rules + semantic embeddings
```

## Fase 3

```text
personalized ranking
```

## Fase 4

```text
learning-to-rank
```

Sempre usar threshold mínimo de relevância.

---

# 40. Notification fatigue

Criar conceito:

```text
NotificationPolicy
```

Exemplo:

```json
{
  "dailyLimit": 3,
  "quietHours": {
    "from": "22:00",
    "to": "08:00"
  },
  "minScore": 70
}
```

Evolução futura:

```text
digest mode
instant
important only
```

---

# 41. Pré-vendas

Modelar explicitamente status de venda.

```text
SaleStatus

ANNOUNCED
PRESALE_SCHEDULED
PRESALE_OPEN
GENERAL_SALE_OPEN
SOLD_OUT
CANCELLED
```

Mudança:

```text
PRESALE_SCHEDULED → PRESALE_OPEN
```

gera:

```text
sale.presale.opened.v1
```

Pode ser evento de alta prioridade.

---

# 42. Multi-city desde o modelo

Nunca criar estrutura específica para BH.

Modelo:

```text
Location {
   countryCode
   region
   city
   latitude
   longitude
   timezone
}
```

MVP:

```text
city = Belo Horizonte
```

Futuro:

```text
São Paulo
Rio de Janeiro
Curitiba
Lisboa
Berlin
```

sem mudança estrutural.

---

# 43. Internacionalização

Código e domínio em inglês:

```text
notification.sent
event.screening
sale.presale
```

UI inicialmente:

```text
pt-BR
```

Strings devem estar preparadas para tradução.

---

# 44. Estrutura de monorepo

```text
platform/
│
├── apps/
│   ├── web/
│   └── telegram-webhook/
│
├── services/
│   ├── catalog/
│   ├── ingestion/
│   ├── matching/
│   ├── notifications/
│   └── tracking/
│
├── connectors/
│   ├── ticketmaster/
│   └── tmdb/
│
├── packages/
│   ├── domain/
│   ├── contracts/
│   ├── observability/
│   ├── config/
│   └── testing/
│
├── infrastructure/
│   └── terraform/
│
├── docs/
│   ├── architecture/
│   ├── adr/
│   ├── api/
│   └── runbooks/
│
└── tests/
```

---

# 45. Modular monolith, não microservices prematuros

Separar:

- domínio;
- contratos;
- ownership;
- boundaries;
- eventos;

sem obrigatoriamente criar dezenas de deploys independentes.

Quando necessário:

```text
modular component
       ↓
independent service
```

A arquitetura orientada a eventos facilitará essa evolução.

---

# 46. Linguagem

Padrão sugerido:

```text
TypeScript
Node.js
```

Motivos:

- tipagem;
- contratos compartilhados;
- bom suporte AWS;
- integração natural com JSON/eventos;
- ecossistema frontend/backend;
- produtividade.

Python pode ser usado futuramente em IA ou processamento específico.

---

# 47. Contratos versionados

Estrutura:

```text
schemas/
  catalog/
    event-discovered-v1.json
    event-updated-v1.json

  notification/
    requested-v1.json
```

Validar eventos em runtime.

Payload inválido não deve seguir silenciosamente.

---

# 48. Versionamento de eventos

Nunca alterar silenciosamente:

```text
catalog.event.discovered.v1
```

Criar:

```text
catalog.event.discovered.v2
```

durante evolução.

Consumers antigos devem conseguir continuar funcionando durante migração.

---

# 49. Infrastructure as Code

Tudo em Terraform:

```text
IAM
Lambda
SQS
DLQ
EventBridge
DynamoDB
S3
CloudWatch
API Gateway
Cognito
CloudFront
DNS
```

Evitar recursos manuais.

---

# 50. Ambientes

Inicialmente:

```text
dev
prod
```

Preview environments quando houver benefício.

Terraform state separado por ambiente.

Idealmente, contas AWS separadas conforme maturidade do projeto.

---

# 51. CI/CD

Pipeline sugerido:

```text
PR
 │
 ├── lint
 ├── typecheck
 ├── unit tests
 ├── contract tests
 ├── security scanning
 ├── IaC validation
 └── terraform plan

merge main
 │
 ├── build
 ├── integration tests
 ├── deploy dev
 ├── smoke tests
 └── deploy prod
```

Autenticação AWS:

```text
GitHub Actions
   ↓
OIDC
   ↓
AWS IAM Role
```

Sem access keys persistentes.

---

# 52. Testes de connectors

Cada connector deverá possuir fixtures:

```text
tests/fixtures/ticketmaster/
tests/fixtures/tmdb/
```

Contract tests:

```text
provider payload
      ↓
connector
      ↓
expected canonical representation
```

---

# 53. Testes end-to-end

Cenário fundamental:

```text
fixture Ticketmaster
       ↓
collector
       ↓
normalizer
       ↓
catalog
       ↓
matcher
       ↓
fake Telegram provider
       ↓
notification assertion
```

Regra de negócio crítica:

> User follows Nolan → new Interstellar screening → exactly one notification.

---

# 54. Feature flags

Exemplos:

```text
ENABLE_AI_MATCHING=false
ENABLE_EMAIL=false
ENABLE_SPONSORED=false
ENABLE_TMDB=true
```

Usar para rollout progressivo e mitigação de risco.

---

# 55. Admin Console

Inicialmente simples.

Rota:

```text
/admin
```

Funções:

```text
sources health
last collection
DLQ size
event search
user search
notification status
manual reprocess
```

---

# 56. Kill switches

Exemplos:

```text
DISABLE_ALL_NOTIFICATIONS
DISABLE_TELEGRAM
DISABLE_SOURCE_TICKETMASTER
DISABLE_AFFILIATE_REDIRECTS
```

Objetivo:

parar rapidamente um fluxo defeituoso sem redeploy complexo.

---

# 57. Disaster Recovery

Não implementar multi-region active-active no MVP.

Implementar:

```text
DynamoDB PITR
S3 versioning
Terraform reproducibility
automated backups
raw data replay
```

O raw data arquivado deve permitir reconstrução do catálogo.

---

# 58. Cenários de escala

## MVP

```text
1.000 usuários
10.000 interesses
2.000 eventos/dia
```

## Crescimento

```text
100.000 usuários
1M interesses
50.000 eventos/dia
```

Aumentar:

```text
SQS workers
Lambda concurrency
DynamoDB throughput
```

sem redesign.

## Escala muito grande

```text
1M+ usuários
```

Possíveis evoluções:

```text
OpenSearch
Kinesis
dedicated recommendation infrastructure
cell-based notification processing
```

Somente quando houver necessidade real.

---

# 59. Componentes da V1

Implementar:

```text
Web application

Cognito authentication

User profiles

Interest management

City = Belo Horizonte

TMDB connector

Ticketmaster connector

Canonical catalog

Entity normalization

Rule-based matching

Telegram notifications

Affiliate/tracking redirect

SQS

EventBridge

DynamoDB

S3 raw archive

Observability

DLQs

Idempotency

IaC

CI/CD

Security baseline

LGPD consent handling
```

---

# 60. Componentes previstos, mas não implementados inicialmente

```text
WhatsApp

mobile application

push notifications

paid plans

sponsored events

producer portal

machine learning ranking

recommendation AI

OpenSearch

data warehouse

multiple countries

cell architecture

multi-region

advanced analytics

Ingresso.com integration

Sympla integration

Cineart partnership
```

---

# 61. Primeiro vertical slice

Não começar construindo "todo o backend".

Primeiro entregar uma linha completa:

```text
TMDB/Ticketmaster
       ↓
real/fake event
       ↓
normalization
       ↓
user follows something
       ↓
match
       ↓
SQS
       ↓
Telegram
       ↓
trackable link
       ↓
click recorded
```

Quando isso funcionar, o produto inteiro existe em miniatura.

Depois ampliar horizontalmente.

---

# 62. Fases de implementação

## Phase 0 — Foundations

```text
repository
ADRs
Terraform
accounts/environments
CI/CD
logging
schemas
domain model
```

## Phase 1 — Identity

```text
users
Cognito
preferences
LGPD
```

## Phase 2 — Catalog

```text
TMDB
Ticketmaster
raw ingestion
normalization
canonical catalog
```

## Phase 3 — Interests

```text
follow movie
follow artist/director
city
```

## Phase 4 — Matching

```text
inverted indexes
rules
scores
deduplication
```

## Phase 5 — Telegram

```text
bot
webhook
notification queues
rate limiting
retries
DLQ
```

## Phase 6 — Monetization

```text
offers
affiliate URLs
redirect tracking
click attribution
```

## Phase 7 — Production Readiness

```text
alarms
dashboards
SLOs
load tests
security tests
backup/recovery
failure scenarios
```

## Phase 8 — Beta BH

```text
real users
real interests
real notifications
conversion metrics
```

---

# 63. Métricas de validação do produto

Não focar somente em cadastros.

## Activation

```text
% users with ≥ 3 interests
```

## Precision

```text
% notifications considered relevant
```

## CTR

```text
notification → ticket/event page
```

## Conversion

```text
notification → ticket purchase
```

quando disponível.

## Retention

```text
does user remain subscribed?
```

## Unsubscribe rate

```text
how many users leave?
```

## Notification-to-value

```text
how many alerts generate action?
```

Possível North Star Metric:

> Monthly relevant event discoveries generated for users.

---

# 64. Abstração conceitual da plataforma

Não pensar na aplicação como:

```text
Cinema Notification App
```

Pensar como:

```text
Interest → Opportunity Engine
```

Modelo conceitual:

```text
USER INTEREST
      +
REAL-WORLD EVENT
      +
TIME / LOCATION
      ↓
ACTIONABLE OPPORTUNITY
```

Hoje:

```text
Interstellar em BH
```

Futuro:

```text
Metallica
theater
festival
course
exhibition
conference
```

---

# 65. Monetização inicial

A primeira fonte de receita deve ser afiliados.

Fluxo:

```text
relevant notification
       ↓
tracked link
       ↓
ticket provider
       ↓
purchase
       ↓
commission
```

Posteriormente:

```text
affiliate commissions
+
sponsored events
+
premium subscriptions
+
B2B analytics
+
producer distribution
```

A arquitetura deve medir desde o início:

```text
interest
→ notification
→ click
→ outbound provider
→ conversion
```

---

# 66. Fontes iniciais de dados

Prioridade inicial:

```text
TMDB
Ticketmaster
```

Objetivos:

- TMDB: obras, filmes, diretores, metadados e lançamentos.
- Ticketmaster: eventos, atrações, venues, venda e affiliate links.

Alvos futuros de parceria:

```text
Ingresso.com
Cineart
Sympla
Shotgun
Eventim
local venues
cultural institutions
```

Evitar scraping não autorizado.

---

# 67. Decisão arquitetural final

O projeto deve nascer como uma arquitetura:

> pequena, profissional, modular, observável, segura, orientada a eventos e preparada para evolução.

Os componentes mais caros de mudar depois devem nascer corretos:

- domínio;
- contratos;
- isolamento de providers;
- canonical model;
- idempotência;
- tracking;
- observabilidade;
- boundaries;
- privacy;
- monetization hooks.

Os componentes caros e complexos devem entrar apenas quando necessários:

- EKS;
- containers;
- OpenSearch;
- Kinesis;
- multi-region;
- cell architecture;
- ML ranking;
- data warehouse;
- mobile apps.

A regra de engenharia do projeto é:

> Não construir arquitetura de brinquedo para o MVP e não construir a arquitetura da Netflix antes de ter usuários.

O objetivo é construir uma base world-class que seja simples hoje e evolutiva amanhã.
