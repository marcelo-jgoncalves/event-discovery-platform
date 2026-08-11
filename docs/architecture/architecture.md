---
status: active
owner: architecture
authority: normative
supersedes: history/architecture-v1.md
---

# Arquitetura — Event Discovery Platform

Única arquitetura vigente do projeto. Histórico de como ela chegou a este ponto (incluindo o desenho original, mais amplo em escopo) vive em `history/architecture-v1.md` — consulte-o apenas por contexto histórico, nunca como fonte normativa; onde os dois divergem, este documento vence.

## Objetivo deste documento

Este documento registra o desenho arquitetural vigente do MVP, resultado de uma revisão crítica do desenho inicial mais amplo.

A intenção não é mudar os fundamentos do produto, que continuam válidos, mas melhorar o equilíbrio entre:

- simplicidade operacional no MVP;
- escalabilidade futura;
- qualidade de engenharia;
- custo de mudança;
- complexidade observada versus complexidade antecipada.

A diretriz central passa a ser:

> Construir antecipadamente aquilo cuja migração seria cara — modelo de domínio, IDs, índices, contratos, idempotência e boundaries.

E adiar aquilo cuja adição futura é barata:

> Event bus, IA sofisticada, search engine, recommendation engine e outros consumidores ainda inexistentes.

Princípio adicional:

> Sophistication must follow observed complexity.

---

# 1. Avaliação geral da arquitetura anterior

Os fundamentos permanecem corretos:

- canonical model;
- connectors plugáveis;
- matching por índice invertido;
- idempotência;
- tracking;
- provider abstraction;
- raw-data retention;
- segurança e observabilidade desde o início;
- serverless-first;
- asynchronous processing;
- monetization instrumentation from day one.

As mudanças desta versão concentram-se em reduzir maquinaria desnecessária na infraestrutura e aumentar o rigor justamente nos componentes que definem se o produto funciona no dia 1:

1. DynamoDB access patterns do matcher;
2. throughput e rate limiting do Telegram;
3. simplificação do fluxo assíncrono;
4. tratamento explícito de entidades não resolvidas;
5. política clara de enrichment.

---

# 2. Decisão 1 — SQS-first na V1

## Problema do desenho anterior

O desenho anterior utilizava EventBridge como bus central de domínio, apesar de inicialmente existir apenas um consumidor real para a maior parte dos eventos.

O fan-out projetado era algo como:

```text
EventDiscovered
      │
      ├── Matcher
      ├── Analytics
      ├── Search Indexer
      └── Recommendation Engine
```

Porém, na V1:

```text
Matcher = consumidor real

Analytics = futuro
Search Indexer = futuro
Recommendation Engine = futuro
```

Isso adicionaria:

- mais recursos;
- mais IAM;
- mais pontos de troubleshooting;
- maior complexidade observacional;
- maior superfície de falha;

sem benefício proporcional no MVP.

## Decisão adotada — SQS direto entre subsistemas

A V1 deve utilizar comunicação assíncrona direta por SQS.

Fluxo principal:

```text
Collectors
   ↓
Ingestion Queue
   ↓
Normalizer
   ↓
Matching Queue
   ↓
Matcher
   ↓
Notification Queues
   ↓
Notification Dispatcher
```

Arquitetura:

```text
                    EXTERNAL SOURCES

             TMDB             Ticketmaster
               │                   │
               └─────────┬─────────┘
                         ▼
                  Source Connectors
                         │
                         ▼
                    Ingestion SQS
                         │
                         ▼
                     Normalizer
                     │        │
                     │        └────────► S3 Raw
                     │
                     ▼
                 Canonical Catalog
                    DynamoDB
                     │
                     ▼
                  Matching SQS
                     │
                     ▼
                     Matcher
                     │
           ┌─────────┴─────────┐
           │                   │
           ▼                   ▼
     Interest Index       Enrichment*
       DynamoDB               SQS
           │                   │
           │              AI / Review
           │
           ▼
      Match Results
           │
           ▼
   Notification Queues
   ┌───────┼─────────┐
   │       │         │
 HIGH    NORMAL      LOW
   │       │         │
   └───────┼─────────┘
           ▼
    Telegram Dispatcher
           │
        Rate limiter
           │
           ▼
       Telegram API
           │
           ▼
        User

* enrichment não bloqueante
```

## Eventos de domínio continuam existindo como contratos

Embora EventBridge não seja usado na infraestrutura da V1, as mensagens devem continuar semanticamente modeladas como eventos de domínio versionados.

Exemplos:

```text
catalog.event.normalized.v1
match.created.v1
notification.requested.v1
notification.sent.v1
```

Exemplo de payload:

```json
{
  "eventType": "catalog.event.normalized.v1",
  "eventId": "01J...",
  "occurredAt": "2026-08-11T12:30:00Z",
  "correlationId": "01J...",
  "source": "ticketmaster",
  "data": {
    "canonicalEventId": "evt_123"
  }
}
```

Assim, futuramente, quando houver fan-out real:

```text
Normalizer
    ↓
EventBridge
    ├── Matcher
    ├── Analytics
    ├── Search Indexer
    └── Recommendation Engine
```

a migração será mecânica.

### ADR recomendado

```text
ADR-001 — Use SQS as the primary asynchronous integration mechanism in V1
```

Decisão:

```text
SQS now
EventBridge when real fan-out appears
```

Rationale:

- menor complexidade operacional;
- menor IAM surface;
- menor número de componentes;
- debugging mais simples;
- contratos continuam event-oriented;
- migração futura simples.

---

# 3. Decisão 2 — Simplificação de Entity Resolution

## Problema anterior

O desenho anterior previa quatro níveis:

```text
1. deterministic identifiers
2. deterministic rules
3. fuzzy matching
4. AI-assisted matching
```

Para apenas TMDB e Ticketmaster, isso é mais sofisticado do que o problema atual exige.

## Entity Resolution da V1

A V1 deve implementar:

```text
Exact External ID
        ↓
   matched?
   /     \
 yes      no
 ↓         ↓
canonical  deterministic composite key
             ↓
           matched?
           /     \
         yes      no
          ↓        ↓
      canonical   UNRESOLVED
                      ↓
                 review queue
```

Prioridade:

### Nível 1 — Identificador externo forte

Exemplo:

```text
same TMDB ID
```

### Nível 2 — Regra determinística simples

Por exemplo:

```text
normalizedTitle
+
releaseYear
+
entityType
```

Somente se necessário.

### Caso não resolvido

Não tentar automaticamente:

```text
fuzzy
LLM
embeddings
semantic resolution
```

na V1.

O item recebe estado explícito.

## ResolutionStatus

Criar enum semelhante a:

```text
ResolutionStatus

RESOLVED
UNRESOLVED
MANUALLY_RESOLVED
IGNORED
```

Um item não resolvido pode seguir para o catálogo, desde que os campos essenciais estejam presentes.

Princípio:

> Falha de enriquecimento ou resolução semântica não deve significar falha de ingestão.

## Review Queue

Criar conceitualmente:

```text
entity-resolution-review
```

Objetivos:

- registrar casos ambíguos;
- permitir análise manual;
- entender quais conflitos realmente aparecem;
- produzir dados para justificar futuras regras ou IA.

### ADR recomendado

```text
ADR-002 — Use deterministic entity resolution only in V1
```

Decisão:

- exact IDs primeiro;
- regras determinísticas simples quando necessário;
- unresolved explícito;
- review queue;
- fuzzy/AI somente após evidência real.

---

# 4. Decisão 3 — Formalizar o DynamoDB Interest Index agora

Este é um dos pontos mais críticos do produto.

O matcher depende da capacidade de responder de forma eficiente:

> Quem se importa com este evento?

Não pode existir:

```text
for each event:
    scan all users
```

Nem:

```text
load all interests
filter in application
```

## InterestIndexTable

Criar uma tabela dedicada ao índice invertido de interesses.

Exemplo:

```text
InterestIndexTable
```

Item:

```text
PK = TARGET#WORK#tmdb:157336
SK = USER#usr_123
```

Para uma pessoa:

```text
PK = TARGET#PERSON#tmdb:525
SK = USER#usr_123
```

Para categoria:

```text
PK = TARGET#CATEGORY#SCI_FI
SK = USER#usr_123
```

## Consulta principal do matcher

Novo evento:

```text
Interstellar
```

Targets derivados:

```text
WORK#tmdb:157336
PERSON#tmdb:525
CATEGORY#SCI_FI
```

O matcher executa apenas queries dos targets relevantes:

```text
Query TARGET#WORK#tmdb:157336
Query TARGET#PERSON#tmdb:525
Query TARGET#CATEGORY#SCI_FI
```

Resultado:

```text
candidate users
```

Depois aplica:

- localização;
- score;
- notification policy;
- deduplication.

## Consulta inversa — interesses do usuário

Também é necessário responder:

> Quais interesses o usuário possui?

Portanto o mesmo item deve suportar acesso inverso via GSI.

Exemplo:

```text
PK = TARGET#WORK#tmdb:157336
SK = USER#usr_123

GSI1PK = USER#usr_123
GSI1SK = TARGET#WORK#tmdb:157336
```

Consultas:

### Quem segue Interstellar?

```text
PK = TARGET#WORK#tmdb:157336
```

### O que o usuário segue?

```text
GSI1PK = USER#usr_123
```

## Location deve fazer parte do desenho de matching

Problema:

```text
TARGET#PERSON#METALLICA
```

pode ter milhões de usuários.

Se surgir evento em Belo Horizonte, não queremos buscar todos para depois filtrar cidade.

O índice deve incorporar geografia.

Possível forma:

```text
PK = TARGET#PERSON#METALLICA#CITY#BR-BHZ
SK = USER#usr_123
```

Outro exemplo:

```text
PK = TARGET#WORK#tmdb:157336#CITY#BR-BHZ
SK = USER#usr_123
```

Assim:

```text
Metallica + Belo Horizonte
```

consulta diretamente:

```text
TARGET#PERSON#METALLICA#CITY#BR-BHZ
```

## Access patterns que devem ser formalizados

```text
AP-001 Get interests by user
AP-002 Find subscribers by work + city
AP-003 Find subscribers by person + city
AP-004 Find subscribers by category + city
AP-005 Remove all subscriptions for user
AP-006 Check whether user already follows target
AP-007 Count subscribers by target + city
```

Somente depois fechar:

```text
PK
SK
GSI1
GSI2
```

### ADR recomendado

```text
ADR-003 — Design the Interest Index around matcher access patterns before implementation
```

Rationale:

- é o hot path do produto;
- scans são inaceitáveis;
- migração futura com dados reais seria cara;
- location deve entrar desde o início;
- acesso bidirecional é necessário.

---

# 5. Revisão das tabelas DynamoDB

Não decidir antecipadamente oito tabelas isoladas apenas por entidade.

Em vez de:

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

partir de bounded contexts e access patterns.

Uma divisão inicial plausível:

```text
UsersTable

CatalogTable

InterestIndexTable

NotificationTable

OperationalStateTable
```

Exemplo:

```text
SourceState
Idempotency
```

podem coexistir em `OperationalStateTable`, caso os access patterns permitam.

Regra:

> Não há prêmio por ter muitas tabelas nem por ter single-table design.

O critério é:

> Qual modelo atende os access patterns sem scans e com menor complexidade operacional?

---

# 6. Decisão 4 — Telegram rate limiting como constraint explícita

O Telegram não deve ser tratado apenas como um provider externo genérico.

Ele possui limites operacionais que afetam diretamente o design.

Constraints relevantes:

```text
~1 msg/s por chat

~30 msg/s em broadcast por bot

limites específicos para grupos
```

## Arquitetura errada

Evitar:

```text
10.000 notifications
       ↓
SQS
       ↓
Lambda scales aggressively
       ↓
Telegram API
       ↓
429
       ↓
retry storm
```

`429` não deve ser usado como mecanismo normal de controle de throughput.

## Arquitetura correta

```text
Notification Queue
       ↓
Telegram Dispatcher
       ↓
Rate Limiter
       ↓
Telegram API
```

O dispatcher deve conhecer:

```text
global bot rate
+
per-chat rate
```

## Controle de concorrência

A integração SQS → Lambda deve ter:

- concurrency control;
- bounded scale;
- backpressure;
- provider-aware throughput.

A Lambda não deve escalar livremente apenas porque existem milhares de mensagens na fila.

Objetivo:

> proteger o downstream.

## Token Bucket / Rate Limiter

O dispatcher deve implementar um mecanismo explícito de rate limiting, por exemplo:

```text
Token Bucket
```

ou mecanismo equivalente.

Propriedades:

```text
global tokens
per-chat tokens
provider retry-after handling
rate-limit metrics
```

---

# 7. Prioridade de notificações

Como o throughput é finito, notificações devem possuir prioridade.

Sugestão:

```text
P0 = presale opened
P1 = exact explicit interest
P2 = related artist/director match
P3 = recommendation/digest
```

Uma pré-venda explicitamente seguida deve ser priorizada sobre recomendações menos importantes.

## Filas de prioridade

Possível desenho:

```text
notification-high
notification-normal
notification-low
```

Exemplos:

```text
PRESALE_OPEN
       ↓
notification-high
```

```text
EXACT_WORK_MATCH
       ↓
notification-high
```

```text
ARTIST_MATCH
       ↓
notification-normal
```

```text
CATEGORY_RECOMMENDATION
       ↓
notification-low
```

O dispatcher sempre favorece filas de maior prioridade.

---

# 8. SLO deve separar matching e delivery

Limite físico do provider significa que:

```text
event detected → notification sent
```

não pode ter o mesmo SLO para qualquer volume.

Separar:

## Match Latency

```text
event detected
→ notification queued
```

## Delivery Latency

```text
notification queued
→ provider accepted
```

Essas são métricas diferentes.

## Exemplo de impacto de throughput

Com aproximadamente:

```text
30 msg/s
```

10.000 mensagens exigem teoricamente:

```text
~333 segundos
≈ 5,5 minutos
```

100.000:

```text
~55 minutos
```

Isso deve influenciar:

- prioridade;
- SLO;
- dashboards;
- capacidade;
- estratégia futura de canais.

## Métricas específicas do Telegram

Adicionar:

```text
telegram_send_rate
telegram_429_count
telegram_queue_age
telegram_queue_depth
telegram_retry_count
telegram_delivery_latency
telegram_per_chat_throttle
telegram_global_throttle
```

### ADR recomendado

```text
ADR-005 — Treat provider throughput as a domain constraint
```

Decisão:

```text
priority
+
rate limiting
+
backpressure
+
idempotency
```

e não apenas retry.

---

# 9. Decisão 5 — AI Enrichment precisa de lifecycle explícito

IA continua fora do caminho crítico.

Mas agora deve existir uma política clara de lifecycle.

## EnrichmentStatus

Criar:

```text
EnrichmentStatus

NOT_REQUIRED
PENDING
COMPLETED
FAILED
EXPIRED
```

## Fluxo

Fluxo principal:

```text
Event arrives
     ↓
canonical normalization
     ↓
READY
     ↓
matcher can use it
```

Paralelamente:

```text
needs enrichment?
       ↓
PENDING
       ↓
AI Enrichment Queue
```

Resultados:

```text
COMPLETED
```

ou:

```text
FAILED
```

ou:

```text
EXPIRED
```

## Catálogo não depende de enrichment

Princípio obrigatório:

> Enrichment melhora relevância; nunca determina disponibilidade do catálogo.

Mesmo se:

- IA estiver indisponível;
- fila estiver atrasada;
- custo de IA estiver limitado;
- enrichment falhar;

o evento continua funcional.

## Deadline / TTL de enrichment

Criar política explícita.

Possíveis regras:

```text
enrichmentDeadline = event.startAt - X
```

ou um TTL operacional definido por tipo de evento.

Se exceder:

```text
status = EXPIRED
```

O sistema segue usando apenas dados determinísticos.

## Trigger para enrichment

Não enviar tudo para IA.

Critérios possíveis:

```text
missing categories
ambiguous entity relation
missing aliases
low-confidence classification
future semantic recommendation
```

Se os dados forem suficientes:

```text
NOT_REQUIRED
```

### ADR recomendado

```text
ADR-006 — AI enrichment is optional and non-blocking
```

Decisão:

- enrichment assíncrono;
- lifecycle explícito;
- deadline/TTL;
- fallback determinístico;
- catálogo nunca bloqueado.

---

# 10. Novo hot path da arquitetura

A prioridade de engenharia da V1 deve ser:

```text
EVENT
 ↓
WHO CARES?
 ↓
NOTIFY
```

Ou, em componentes:

```text
Canonical IDs
       ↓
Interest Index
       ↓
Matcher
       ↓
Deduplication
       ↓
Notification Scheduling
       ↓
Rate Limiting
       ↓
Tracking
```

Esse é o caminho que define o valor do produto.

---

# 11. Componentes cuja sofisticação deve ser adiada

Nesta fase, apenas interfaces/stubs:

```text
EventBridge
AI matching
semantic search
recommendation engine
OpenSearch
multi-region
cell architecture
learning-to-rank
```

Adicionar somente quando houver:

- segundo consumidor real;
- volume real;
- problema real;
- evidência de necessidade.

---

# 12. Arquitetura V2 resumida

```text
TMDB / Ticketmaster
        ↓
Source Connectors
        ↓
Ingestion SQS
        ↓
Normalizer
        ↓
Canonical Catalog
        ↓
Matching SQS
        ↓
Matcher
        ↓
InterestIndexTable
        ↓
Match
        ↓
Priority Notification Queues
        ↓
Telegram Dispatcher
        ↓
Provider-aware Rate Limiter
        ↓
Telegram API
        ↓
User
```

Fluxos laterais:

```text
Normalizer
   ↓
S3 Raw Archive
```

```text
Ambiguous Entity
   ↓
Resolution Review Queue
```

```text
Needs Enrichment
   ↓
AI Enrichment Queue
   ↓
Optional Enrichment
```

---

# 13. Componentes mantidos da arquitetura original

Continuam obrigatórios:

```text
canonical model
connectors plugáveis
raw payload archive
idempotency
correlation IDs
structured logging
metrics
DLQs
retry with exponential backoff + jitter
circuit breaker
least privilege IAM
Secrets Manager
Terraform
CI/CD
OIDC
LGPD by design
affiliate abstraction
click tracking
provider abstraction
feature flags
kill switches
```

---

# 14. O que foi removido da V1

Remover da implementação imediata:

```text
EventBridge as central domain bus

multi-level fuzzy entity resolution

AI entity resolution

OpenSearch

recommendation engine

advanced semantic matching

complex analytics fan-out
```

Continuam documentados como caminhos de evolução.

---

# 15. O que ganhou prioridade

Aprofundar antes da implementação:

```text
InterestIndexTable design

DynamoDB access patterns

location-aware matching

notification priority

Telegram global rate limit

Telegram per-chat rate limit

SQS/Lambda concurrency controls

delivery latency

enrichment lifecycle
```

---

# 16. Novos princípios arquiteturais

## Principle 1

> Sophistication must follow observed complexity.

## Principle 2

> Build expensive-to-change decisions early; defer cheap-to-add capabilities.

## Principle 3

> Provider throughput is a domain constraint, not merely an infrastructure error condition.

## Principle 4

> Enrichment may improve decisions but must never block core product availability.

## Principle 5

> The matcher access pattern is a first-class architecture concern.

---

# 17. Decisões caras de mudar — resolver cedo

Estas devem ser definidas corretamente antes de produção:

```text
canonical IDs
domain model
external provider boundaries
message contracts
interest indexing
location model
idempotency model
tracking model
notification priorities
user/channel separation
```

---

# 18. Decisões baratas de adicionar — adiar

```text
EventBridge
OpenSearch
AI matching
advanced recommendation
additional consumers
multi-region
cell-based architecture
complex data warehouse
```

---

# 19. ADRs recomendados

Criar formalmente:

```text
ADR-001 Messaging Topology V1 — SQS-first

ADR-002 Canonical Entity Identification

ADR-003 Interest Index DynamoDB Design

ADR-004 Location-aware Matching

ADR-005 Notification Priority and Rate Limiting

ADR-006 AI Enrichment Lifecycle

ADR-007 Provider Abstraction

ADR-008 Idempotency Strategy

ADR-009 Tracking and Affiliate Redirect Model
```

---

# 20. Próximo trabalho arquitetural prioritário

Antes de começar a implementar o matcher, produzir um documento específico:

```text
DynamoDB Access Pattern Specification
```

Esse documento deve conter:

- todos os access patterns;
- volume esperado;
- cardinalidade;
- PK/SK;
- GSIs;
- exemplos de itens;
- queries;
- writes;
- deletes;
- hot partition analysis;
- city/target partition strategy;
- eventual necessidade de sharding;
- consistency requirements;
- TTL usage;
- cost implications.

Esse documento é prioritário porque o Interest Index é um dos componentes mais caros de migrar após haver dados reais.

---

# 21. Segundo trabalho arquitetural prioritário

Produzir:

```text
Notification Delivery Design
```

Deve conter:

- Telegram global rate limit;
- per-chat rate limit;
- priority queues;
- concurrency;
- token bucket;
- retry behavior;
- 429 handling;
- DLQ;
- delivery ordering;
- idempotency;
- quiet hours;
- daily user limit;
- P95/P99 queue age;
- throughput projections;
- migration path for WhatsApp/email/push.

---

# 22. Conclusão

A arquitetura original permanece válida em seus fundamentos, mas a V2 melhora significativamente a relação entre simplicidade e robustez.

O foco da V1 passa a ser:

```text
simple infrastructure
+
strong domain design
+
correct access patterns
+
provider-aware delivery
```

e não:

```text
future infrastructure built in advance
```

A arquitetura deve ser considerada world-class não porque possui muitas tecnologias, mas porque:

- os limites estão bem definidos;
- o core path é eficiente;
- as decisões caras de mudar foram tomadas cedo;
- componentes opcionais podem ser adicionados depois;
- falhas são isoladas;
- fornecedores externos não contaminam o domínio;
- throughput real faz parte do desenho;
- o sistema permanece funcional mesmo sem IA.

Resumo:

> Não construir arquitetura de brinquedo para o MVP.

Mas também:

> Não construir a arquitetura da Netflix antes de ter usuários.

O objetivo é uma plataforma simples hoje, profissional desde o primeiro dia e evolutiva quando a complexidade real surgir.

---

# 23. Addendum — correções pós-revisão

Este addendum registra as correções identificadas na avaliação crítica desta V2, já resolvidas pelos documentos de especificação produzidos em seguida (`docs/architecture/spec-dynamodb-access-patterns.md` e `docs/architecture/spec-notification-delivery.md`). Mantido aqui para rastreabilidade da decisão.

## 23.1 Lacuna — interesse sem preferência de cidade

A seção 4 (`InterestIndexTable`) definia a PK sempre com `CITY#<id>` embutido, sem tratar o caso de um usuário querer seguir um alvo (ex: um artista) em qualquer cidade, não só na sua cidade padrão. Misturar essa semântica depois, com dados reais em produção, seria uma migração cara — exatamente o tipo de decisão que a V2 recomenda resolver cedo.

**Resolvido em `spec-dynamodb-access-patterns.md` (seções 4.3 e 5):** `locationScope` passa a ser um campo explícito e obrigatório do interesse, com dois valores possíveis na V1:

```text
CITY#<canonical-city-id>
ANY
```

`ANY` nunca é representado como `city = null`/campo ausente/string vazia — é um valor de primeira classe. O matcher consulta sempre duas partições por target (`CITY#<id>` e `ANY`) e une os resultados. Regra de precedência definida: criar `ANY` substitui scopes específicos do mesmo target; criar um scope específico quando `ANY` já existe exige escolha explícita do usuário — evita notificação duplicada e semântica ambígua.

## 23.2 Trabalhos arquiteturais prioritários (seções 20 e 21) — concluídos

Os dois documentos que a V2 apontava como pré-requisito antes de implementar o matcher e o dispatcher de notificações foram produzidos:

- **DynamoDB Access Pattern Specification** → `spec-dynamodb-access-patterns.md`. Decisão final: duas projeções explícitas (`Match Projection` e `User Projection`) gravadas atomicamente via `TransactWriteItems`, **sem GSI no hot path** — divergência da sugestão original de GSI para consulta inversa (seção 4 da V2), adotada por eliminar atraso de propagação e permitir strong consistency nos dois sentidos. Inclui hot partition analysis com trigger numérico de sharding (>250k assinantes por target-location) e todos os 11 access patterns com consistency/cardinalidade definidos.
- **Notification Delivery Design** → `spec-notification-delivery.md`. Decisão final: ceiling seguro de 28 msg/s, token bucket distribuído em DynamoDB (global + per-chat), 3 filas de prioridade com scheduling ponderado 70/20/10, concorrência Lambda calculada a partir de latência real estimada (não valor arbitrário). Define semântica explícita de "delivery ambíguo" (sem exactly-once garantido).

## 23.3 Pendência aberta a monitorar

A decisão de "duas projeções em vez de GSI" (seção 8 do spec de DynamoDB) introduz write amplification deliberado e depende de `TransactWriteItems` estar sempre correto. É uma decisão cara de reverter depois — recomenda-se validar com teste de carga real (seção 34 do spec) antes de produção, não só em desenvolvimento.
