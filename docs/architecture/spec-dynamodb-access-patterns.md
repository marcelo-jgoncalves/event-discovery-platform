# DynamoDB Access Pattern Specification

## 1. Objetivo

Especificar o modelo DynamoDB usado pelo matching do MVP com detalhe suficiente para implementação direta, preservando as decisões da Arquitetura V2:

- SQS-first;
- matching por índice invertido;
- location-aware matching;
- entity resolution determinística na V1;
- enrichment não-bloqueante;
- ausência de scans no hot path.

Princípio central:

> The matcher access pattern is a first-class architecture concern.

A decisão principal deste documento é:

> `InterestIndexTable` usa duas projeções explícitas por interesse, gravadas atomicamente: uma orientada ao matcher (`TARGET + LOCATION -> USERS`) e outra orientada ao usuário (`USER -> INTERESTS`). Nenhum GSI é necessário no hot path da V1.

---

# 2. Escopo

Este documento cobre:

```text
InterestIndexTable
NotificationTable       # somente onde interfere em matching/idempotência
OperationalStateTable   # TTL/idempotência/review operacional
```

Não redefine:

```text
CatalogTable
UsersTable
canonical entity model
entity resolution strategy
notification delivery pipeline
```

---

# 3. Premissas de volume

Cenários herdados da arquitetura:

## MVP

```text
Users                    1,000
Average interests/user      10
Logical interests         10,000
Events/day                 2,000
Primary city          Belo Horizonte
```

## Crescimento

```text
Users                  100,000
Average interests/user      10
Logical interests       1,000,000
Events/day                50,000
Multiple cities             yes
```

Premissas adicionais para sizing inicial:

```text
Average match-index item       <= 500 B
Average user-projection item   <= 1 KB
Average targets/event             3
Location scopes queried/event     2
  - exact city
  - LOCATION#ANY
```

Essas premissas devem ser medidas em produção e revistas trimestralmente ou quando o volume variar em 10x.

---

# 4. Conceitos de chave

## 4.1 TargetType

```text
WORK
PERSON
CATEGORY
```

Futuro, sem redesenho estrutural:

```text
FRANCHISE
VENUE
ORGANIZATION
```

## 4.2 Canonical Target ID

Formato:

```text
<TYPE>#<namespace>:<external-or-canonical-id>
```

Exemplos:

```text
WORK#tmdb:157336
PERSON#tmdb:525
CATEGORY#SCI_FI
```

O namespace faz parte do identificador; IDs de providers diferentes nunca são tratados como equivalentes por acidente.

## 4.3 LocationScope

O escopo geográfico é explícito e obrigatório.

Tipos V1:

```text
CITY#<canonical-city-id>
ANY
```

Exemplo BH:

```text
CITY#BR-MG-BHZ
```

Interesse sem preferência de cidade:

```text
ANY
```

Nunca representar “qualquer lugar” como:

```text
city = null
missing city
empty string
```

Isso evita semântica ambígua e migração futura.

---

# 5. Decisão — interesse sem preferência de cidade

Um interesse possui um `locationScope` explícito.

Exemplos:

```json
{
  "target": "PERSON#tmdb:525",
  "locationScope": "CITY#BR-MG-BHZ"
}
```

ou:

```json
{
  "target": "PERSON#tmdb:525",
  "locationScope": "ANY"
}
```

Para um evento em Belo Horizonte, o matcher consulta duas partições por target:

```text
TARGET#PERSON#tmdb:525#LOCATION#CITY#BR-MG-BHZ
TARGET#PERSON#tmdb:525#LOCATION#ANY
```

Os resultados são unidos e deduplicados por `userId`.

Consequência:

```text
seguir em BH     != seguir em qualquer lugar
```

O usuário pode manter ambos apenas se a API explicitamente permitir; por padrão, a criação de `ANY` substitui scopes específicos do mesmo target e a criação de um scope específico quando `ANY` existe exige escolha explícita do usuário.

Isso evita notificações duplicadas e semântica confusa.

---

# 6. Evolução para múltiplas cidades

O modelo não pressupõe uma cidade única.

Um interesse lógico pode futuramente conter:

```json
{
  "interestId": "int_01J...",
  "target": "PERSON#tmdb:525",
  "locationScopes": [
    "CITY#BR-MG-BHZ",
    "CITY#BR-SP-SAO"
  ]
}
```

Na V1:

```text
max locationScopes per logical interest = 1
```

No futuro, cada scope adicional cria apenas uma nova projeção de match:

```text
TARGET#...#LOCATION#CITY#BR-MG-BHZ -> USER
TARGET#...#LOCATION#CITY#BR-SP-SAO -> USER
```

A projeção orientada ao usuário continua sendo um único registro lógico.

Não há mudança de chave ou migração do índice.

---

# 7. InterestIndexTable — modelo final V1

## 7.1 Capacity mode

```text
PAY_PER_REQUEST / On-Demand
```

Motivo:

- padrão de carga ainda desconhecido;
- onboarding pode ocorrer em bursts;
- MVP não deve exigir capacity planning manual;
- migração posterior para provisioned é operacional, não mudança de schema.

## 7.2 Primary key

```text
PK  string
SK  string
```

Sem LSI.

Sem GSI obrigatório na V1.

## 7.3 Projeção A — Match Projection

Serve:

```text
TARGET + LOCATION -> USERS
```

Formato:

```text
PK = TARGET#<target>#LOCATION#<scope>
SK = USER#<userId>
```

Exemplo WORK + BH:

```json
{
  "PK": "TARGET#WORK#tmdb:157336#LOCATION#CITY#BR-MG-BHZ",
  "SK": "USER#usr_123",
  "entityType": "INTEREST_MATCH_PROJECTION",
  "interestId": "int_01JABC",
  "userId": "usr_123",
  "targetType": "WORK",
  "targetId": "tmdb:157336",
  "locationScope": "CITY#BR-MG-BHZ",
  "minScore": 70,
  "createdAt": "2026-08-11T20:00:00Z"
}
```

PERSON + BH:

```json
{
  "PK": "TARGET#PERSON#tmdb:525#LOCATION#CITY#BR-MG-BHZ",
  "SK": "USER#usr_123",
  "entityType": "INTEREST_MATCH_PROJECTION",
  "interestId": "int_01JDEF",
  "userId": "usr_123",
  "targetType": "PERSON",
  "targetId": "tmdb:525",
  "locationScope": "CITY#BR-MG-BHZ",
  "minScore": 70
}
```

CATEGORY + BH:

```json
{
  "PK": "TARGET#CATEGORY#SCI_FI#LOCATION#CITY#BR-MG-BHZ",
  "SK": "USER#usr_123",
  "entityType": "INTEREST_MATCH_PROJECTION",
  "interestId": "int_01JGHI",
  "userId": "usr_123",
  "targetType": "CATEGORY",
  "targetId": "SCI_FI",
  "locationScope": "CITY#BR-MG-BHZ",
  "minScore": 70
}
```

PERSON + qualquer lugar:

```json
{
  "PK": "TARGET#PERSON#tmdb:525#LOCATION#ANY",
  "SK": "USER#usr_456",
  "entityType": "INTEREST_MATCH_PROJECTION",
  "interestId": "int_01JXYZ",
  "userId": "usr_456",
  "targetType": "PERSON",
  "targetId": "tmdb:525",
  "locationScope": "ANY",
  "minScore": 70
}
```

## 7.4 Projeção B — User Projection

Serve:

```text
USER -> INTERESTS
```

Formato:

```text
PK = USER#<userId>
SK = INTEREST#<interestId>
```

Exemplo:

```json
{
  "PK": "USER#usr_123",
  "SK": "INTEREST#int_01JABC",
  "entityType": "USER_INTEREST_PROJECTION",
  "interestId": "int_01JABC",
  "userId": "usr_123",
  "targetType": "WORK",
  "targetId": "tmdb:157336",
  "targetKey": "WORK#tmdb:157336",
  "locationScopes": ["CITY#BR-MG-BHZ"],
  "minScore": 70,
  "createdAt": "2026-08-11T20:00:00Z",
  "updatedAt": "2026-08-11T20:00:00Z"
}
```

---

# 8. Por que duas projeções em vez de GSI

A V2 sugeria GSI como possibilidade para consulta inversa. O desenho final não usa GSI no hot path.

Motivos:

```text
Target query -> base table Query
User query   -> base table Query
```

Benefícios:

- ambos podem usar strong consistency quando necessário;
- não existe atraso de propagação de GSI no fluxo principal;
- access patterns ficam explícitos;
- criação/remoção pode ser atômica com `TransactWriteItems`;
- schema continua simples.

Custo:

```text
2 item writes por interesse criado
2 item deletes por interesse removido
```

Esse write amplification é deliberado.

Princípio:

> Duplicação controlada de dados é preferível a scans ou joins no hot path.

---

# 9. GSIs V1

```text
Nenhum GSI obrigatório.
```

Não criar GSI “para o caso de precisar”.

Adicionar somente quando houver access pattern real que não possa ser atendido pela chave primária.

Possíveis GSIs futuros:

```text
GSI by target type/status for admin
GSI by createdAt for operational analysis
```

Nenhum deles participa do matcher V1.

---

# 10. Access patterns finais

## AP-001 — Get interests by user

Query:

```text
PK = USER#<userId>
SK begins_with INTEREST#
```

Cardinalidade:

```text
MVP         ~10 items/user
Growth      ~10-50 items/user typical
upper guard 500 active interests/user
```

Perfil:

```text
read-heavy for UI
low absolute volume
```

Consistency:

```text
Strong preferred immediately after mutation
Eventual acceptable for non-interactive background reads
```

---

## AP-002 — Find subscribers by WORK + city

Query:

```text
PK = TARGET#WORK#<id>#LOCATION#CITY#<cityId>
```

Mais:

```text
PK = TARGET#WORK#<id>#LOCATION#ANY
```

Resultados unidos por `userId`.

Cardinalidade:

```text
MVP       0-1,000 users/target-city
Growth    0-100,000 possible worst case
Typical   expected far below total user base
```

Perfil:

```text
read-heavy
hot path
```

Consistency:

```text
Strong for candidate discovery in V1
```

Justificativa:

um usuário que acabou de seguir algo deve poder entrar no matching imediatamente; como a query é na base table, isso é possível.

---

## AP-003 — Find subscribers by PERSON + city

Query:

```text
PK = TARGET#PERSON#<id>#LOCATION#CITY#<cityId>
PK = TARGET#PERSON#<id>#LOCATION#ANY
```

Cardinalidade:

```text
MVP       0-1,000
Growth    potentially tens of thousands for popular artists
```

Perfil:

```text
read-heavy
potential hot target
```

Consistency:

```text
Strong in V1
```

---

## AP-004 — Find subscribers by CATEGORY + city

Query:

```text
PK = TARGET#CATEGORY#<id>#LOCATION#CITY#<cityId>
PK = TARGET#CATEGORY#<id>#LOCATION#ANY
```

Cardinalidade:

```text
MVP       potentially high relative to users
Growth    potentially large fraction of city users
```

Perfil:

```text
read-heavy
highest fan-out risk
```

Consistency:

```text
Eventual acceptable if category recommendations are low priority
Strong only if the category is being used for an explicit notification path
```

V1 recommendation:

```text
CATEGORY matches are lower priority than explicit WORK/PERSON matches.
```

---

## AP-005 — Remove all subscriptions for user

Passo 1:

```text
Query PK = USER#<userId>
```

Passo 2:

para cada user projection, derivar todas as match projection keys.

Passo 3:

```text
TransactWriteItems / batched transactional deletes
```

Cardinalidade:

```text
~10 typical
max guard 500
```

Perfil:

```text
write-heavy operation
rare
account deletion / privacy flow
```

Consistency:

```text
Strong
```

Observação:

DynamoDB `TransactWriteItems` suporta até o limite vigente do serviço por transação; exclusões acima do limite devem ser processadas em lotes idempotentes.

---

## AP-006 — Check whether user already follows target

A API recebe:

```text
userId
target
locationScope
```

Não fazer scan do usuário.

Na V1, a API calcula um `interestFingerprint` determinístico:

```text
sha256(userId | targetType | targetId | normalizedLocationScope)
```

E usa `interestId` derivado/estável:

```text
int_<base32(first 128 bits of hash)>
```

Então:

```text
GetItem
PK = USER#<userId>
SK = INTEREST#<deterministicInterestId>
```

Cardinalidade:

```text
1 item
```

Perfil:

```text
read-before-write or conditional-write
common on create
```

Consistency:

```text
Strong
```

Preferência de implementação:

```text
Conditional transactional write
```

em vez de read-before-write, evitando race condition.

---

## AP-007 — Count subscribers by target + city

Esse não é um hot-path requirement da V1.

Consulta permitida para operações/admin de baixo volume:

```text
Query Select=COUNT
PK = TARGET#...#LOCATION#...
```

Cardinalidade:

```text
0-100,000 in Growth scenario
```

Perfil:

```text
rare
analytics/admin
potentially expensive for popular targets
```

Consistency:

```text
Eventual
```

Decisão:

```text
Não manter contador síncrono por target/location na V1.
```

Motivo:

um contador único introduziria uma hot write key desnecessária e adicionaria write amplification em toda criação/remoção.

Trigger para contador dedicado/sharded:

```text
AP-007 becomes user-facing or > 100 queries/hour
OR p95 query cost/latency violates admin SLO
```

---

# 11. Access patterns adicionais necessários

## AP-008 — Create interest idempotently

Inputs:

```text
userId
targetType
targetId
locationScope
minScore
```

Writes:

```text
1 User Projection
1 Match Projection
```

Atomicidade:

```text
TransactWriteItems
```

Condition:

```text
attribute_not_exists(PK) AND attribute_not_exists(SK)
```

Profile:

```text
write-heavy mutation
low/medium frequency
```

---

## AP-009 — Remove one interest

Input:

```text
userId
interestId
```

Read user projection strongly consistent.

Derive match projection keys.

Delete both projections transactionally.

Profile:

```text
write mutation
low frequency
```

---

## AP-010 — Find global subscribers for target

Query:

```text
PK = TARGET#<target>#LOCATION#ANY
```

Profile:

```text
read-heavy during matching
```

Esse AP existe explicitamente para evitar tratar `ANY` como ausência de cidade.

---

## AP-011 — Fetch candidate notification preferences

O `InterestIndexTable` não deve carregar PII nem todo o perfil do usuário.

Match projection contém apenas atributos necessários ao matching:

```text
userId
interestId
minScore
optional interest-level flags
```

Após deduplicar candidatos, preferências de entrega são obtidas de `UsersTable`/projection apropriada via `BatchGetItem`.

Profile:

```text
read-heavy after candidate selection
```

Consistency:

```text
Eventual acceptable for non-security preferences
Strong for account-disabled/deleted state when processing delete flows
```

---

# 12. Write path — criar interesse

Input:

```json
{
  "userId": "usr_123",
  "targetType": "WORK",
  "targetId": "tmdb:157336",
  "locationScope": "CITY#BR-MG-BHZ",
  "minScore": 70
}
```

Passos:

```text
1. Validate canonical target exists.
2. Normalize locationScope.
3. Build deterministic interestId.
4. Build User Projection.
5. Build Match Projection.
6. TransactWriteItems:
   - Put User Projection with condition not exists
   - Put Match Projection with condition not exists
7. Return created interest.
```

Falha de duplicidade:

```text
ConditionalCheckFailed
→ map to 409/ALREADY_EXISTS or idempotent 200 according to API contract
```

Recomendação:

```text
PUT-style semantics -> return existing logical resource as success
```

---

# 13. Write path — remover interesse

```text
1. Strong GetItem USER#... / INTEREST#...
2. If absent -> idempotent success.
3. Derive all match projection keys from stored locationScopes.
4. Transactionally delete:
   - User Projection
   - Match Projection(s)
5. Return success.
```

Conta com múltiplas cidades no futuro:

```text
1 user projection
N match projections
```

O schema já suporta isso.

---

# 14. Matcher read path

Evento normalizado:

```json
{
  "eventId": "evt_789",
  "cityId": "BR-MG-BHZ",
  "targets": [
    "WORK#tmdb:157336",
    "PERSON#tmdb:525",
    "CATEGORY#SCI_FI"
  ]
}
```

Queries derivadas:

```text
WORK#tmdb:157336 + CITY#BR-MG-BHZ
WORK#tmdb:157336 + ANY

PERSON#tmdb:525 + CITY#BR-MG-BHZ
PERSON#tmdb:525 + ANY

CATEGORY#SCI_FI + CITY#BR-MG-BHZ
CATEGORY#SCI_FI + ANY
```

Fluxo:

```text
Query each partition
      ↓
page results
      ↓
union by userId
      ↓
retain strongest match reason/score
      ↓
BatchGet delivery/user policy data
      ↓
apply policy
      ↓
generate notification candidate
```

Nunca:

```text
Scan InterestIndexTable
Scan UsersTable
```

---

# 15. Deduplicação de candidatos

Um usuário pode corresponder por vários targets:

```text
follows Interstellar
follows Christopher Nolan
follows Sci-Fi
```

O matcher deve produzir uma única candidate notification por evento/trigger.

Estrutura temporária lógica:

```text
candidate[userId] = {
  bestScore,
  reasons[],
  matchedInterestIds[]
}
```

Prioridade de reason V1:

```text
EXACT_WORK
EXACT_PERSON
CATEGORY
```

A idempotência final continua sendo responsabilidade da `NotificationTable`/pipeline de notificação.

---

# 16. Hot partition analysis

## 16.1 Limite físico relevante

DynamoDB documenta capacidade máxima de uma partição física de aproximadamente:

```text
1,000 WCU/s
3,000 strongly consistent RCU/s
6,000 eventually consistent reads/s equivalent for <=4 KB items
```

Adaptive capacity ajuda, mas não deve ser tratado como substituto de uma boa partition key.

## 16.2 Cenário — Metallica + BH

Partition key:

```text
TARGET#PERSON#...METALLICA#LOCATION#CITY#BR-MG-BHZ
```

No cenário Growth, mesmo que todos os 100.000 usuários sigam esse target:

```text
~100,000 match projection items
```

O risco principal não é storage; é throughput concentrado durante:

```text
mass subscription burst
or
single-event fan-out query
```

## 16.3 Decisão V1

```text
No write sharding.
No read sharding.
```

Motivos:

- 100k usuários totais ainda é compatível com paginação controlada;
- writes de subscriptions são distribuídos no tempo na expectativa inicial;
- sharding adicionaria N queries por target em todo match;
- sharding é barato de adicionar antes de superar esse envelope se métricas forem monitoradas.

## 16.4 Guardrails

Alarmar:

```text
ReadThrottleEvents > 0
WriteThrottleEvents > 0
ThrottledRequests > 0
SuccessfulRequestLatency p99 abnormal
match_partition_page_count p95 > 25
match_candidate_count p95 > 25,000
```

## 16.5 Trigger para sharding

Adotar sharding quando qualquer condição persistir:

```text
single target-location > 250,000 active subscribers
OR
sustained > 500 writes/s to same logical target-location
OR
candidate Query throttles despite adaptive capacity
OR
p95 candidate retrieval exceeds matching SLO for 7 days
```

## 16.6 Evolução — write/read sharding

Formato futuro:

```text
PK = TARGET#...#LOCATION#...#SHARD#00
...
PK = TARGET#...#LOCATION#...#SHARD#0F
```

Shard assignment:

```text
shard = hash(userId) mod N
```

Matcher:

```text
Query N shards in bounded parallelism
union results
```

Migration strategy:

```text
1. Introduce shardVersion on logical target.
2. Dual-read unsharded + sharded.
3. Backfill existing projections.
4. Dual-write during transition.
5. Stop old writes.
6. Remove old partition after verification.
```

Não implementar antes do trigger.

---

# 17. Consistency requirements

| Access Pattern | Consistency | Rationale |
|---|---|---|
| AP-001 user interests | Strong after mutation; eventual otherwise | immediate UI correctness |
| AP-002 WORK candidates | Strong | newly created explicit follow should match immediately |
| AP-003 PERSON candidates | Strong | same reason as WORK |
| AP-004 CATEGORY candidates | Eventual default | lower priority; lower cost |
| AP-005 delete all | Strong | privacy/account deletion |
| AP-006 existence | Strong / conditional write | race-free idempotency |
| AP-007 counts | Eventual | analytics/admin only |
| AP-008 create | Transactional write | projections must stay consistent |
| AP-009 remove | Strong + transactional delete | avoid orphan projection |
| AP-010 ANY candidates | Strong for explicit target | same as exact-city explicit follow |
| AP-011 user delivery preferences | Eventual normally | preferences tolerate short propagation |

Nota:

```text
Base table Query/GetItem can request strong consistency.
GSI reads are eventual only.
```

A escolha de duas projeções na base table é intencional.

---

# 18. TTL usage

`InterestIndexTable`:

```text
No TTL for active interests.
```

Interesses são removidos explicitamente.

`OperationalStateTable` pode usar TTL para:

```text
idempotency records
temporary locks
review queue metadata after terminal resolution
rate-limit windows if persisted there
```

Sugestões:

```text
Idempotency records       7-30 days depending operation
Resolved review items     30 days
Temporary locks           seconds/minutes
```

Regra importante:

> DynamoDB TTL is asynchronous deletion, not a scheduler.

Itens expirados podem permanecer por algum tempo após `expiresAt`; toda leitura de estado temporal deve validar `expiresAt` na aplicação.

Nunca depender da remoção física imediata.

---

# 19. Idempotency data model relevante ao matching

Exemplo em `OperationalStateTable`:

```json
{
  "PK": "IDEMPOTENCY#INTEREST_CREATE#usr_123#int_01JABC",
  "SK": "STATE",
  "status": "COMPLETED",
  "expiresAt": 1780000000
}
```

Em muitos casos, o próprio conditional transaction do `InterestIndexTable` elimina a necessidade de um registro separado.

Regra:

```text
Use dedicated idempotency record only when the operation spans resources/services
or requires replaying a stored response.
```

---

# 20. Volume projetado — storage

## MVP

```text
10,000 logical interests
x 2 projections
= 20,000 items
```

Assumindo média combinada próxima de 1 KB/item:

```text
~20 MB order of magnitude
```

## Crescimento

```text
1,000,000 logical interests
x 2 projections
= 2,000,000 items
```

Assumindo média combinada <= 1 KB/item:

```text
~2 GB order of magnitude
```

Mesmo adicionando overhead, continua pequeno para DynamoDB.

---

# 21. Volume projetado — writes

## Carga inicial acumulada

MVP:

```text
10,000 interests x 2 writes
= 20,000 item writes
```

Growth:

```text
1,000,000 interests x 2 writes
= 2,000,000 item writes
```

TransactWrite consome capacidade adicional em relação a writes padrão; o sizing financeiro deve considerar transações explicitamente no AWS Pricing Calculator.

## Churn mensal hipotético

Assumindo 10% dos interesses criados/removidos por mês:

MVP:

```text
~1,000 interest mutations
~2,000 projection operations per create/delete side
```

Growth:

```text
~100,000 interest mutations
~200,000 projection writes/deletes per side
```

Esse volume não justifica provisioned capacity inicialmente.

---

# 22. Volume projetado — matching reads

Cada evento com 3 targets e dois scopes gera até:

```text
3 x 2 = 6 Query operations
```

## MVP

```text
2,000 events/day
x 6 queries
= 12,000 Query calls/day
~360,000/month
```

## Crescimento

```text
50,000 events/day
x 6 queries
= 300,000 Query calls/day
~9,000,000/month
```

O custo real é determinado pelos bytes lidos, não apenas pelo número de chamadas.

Guardrail de item:

```text
Match projection <= 500 B target
```

Isso reduz RRU durante fan-out.

---

# 23. Custo projetado

## 23.1 Capacity mode

```text
On-Demand / PAY_PER_REQUEST
```

## 23.2 Cost drivers

Principais componentes:

```text
InterestIndex writes
InterestIndex reads
transactional write multiplier
storage
optional PITR/backups
```

Não incluir no cálculo desta especificação:

```text
Lambda
SQS
CloudWatch
CatalogTable
NotificationTable
```

## 23.3 Ordem de grandeza

MVP:

```text
20k stored projection items
~360k matcher Query calls/month before candidate-page effects
small storage footprint
```

Esperado:

```text
DynamoDB InterestIndex cost is negligible relative to the rest of the MVP.
```

Growth:

```text
2M stored projection items
~9M matcher Query calls/month before candidate-page effects
candidate fan-out becomes dominant cost variable
```

Esperado:

```text
still low-to-moderate DynamoDB cost for this component,
with cost driven by popularity distribution rather than total event count alone.
```

## 23.4 Regra financeira

Não hardcode preço por request no design.

Antes de cada release de infraestrutura relevante:

```text
1. Obtain current sa-east-1 price from AWS Pricing Calculator / Price List.
2. Calculate WRUs/RRUs from measured item sizes.
3. Include transactional write multiplier.
4. Include PITR/storage separately.
```

Budget alarm deve existir mesmo no MVP.

---

# 24. Payload minimization

Match Projection deve conter somente dados necessários para decidir o match.

Evitar:

```text
email
phone
telegramChatId
user profile
descriptions
large target metadata
```

Isso reduz:

- RRU;
- storage;
- PII exposure;
- hot-partition read cost.

---

# 25. PII boundary

`InterestIndexTable` pode armazenar:

```text
opaque userId
```

Não deve armazenar:

```text
email
phone
name
Telegram username
Telegram chat ID
```

O matcher trabalha com IDs opacos.

Delivery data é obtido somente depois que o candidate set foi reduzido.

---

# 26. Delete/account-erasure behavior

Para exclusão LGPD:

```text
1. mark user DELETING in UsersTable
2. stop new notification planning for user
3. Query USER#<userId> projections strongly
4. delete all Match Projections + User Projections idempotently
5. delete/expire notification and operational PII references according to retention policy
6. finalize user deletion
```

O estado `DELETING` evita race com matcher durante remoção.

---

# 27. Failure handling

## Partial transaction failure

Não existe partial commit em `TransactWriteItems`.

Logo:

```text
User Projection and Match Projection either both commit or neither commits.
```

## Matcher pagination failure

Persistir no SQS message/checkpoint:

```text
eventId
target
locationScope
ExclusiveStartKey
correlationId
```

ou reprocessar a query de forma idempotente.

V1 preference:

```text
reprocess target partition page with downstream idempotency
```

Evitar checkpoint infrastructure até necessidade comprovada.

---

# 28. Query parallelism

Para um evento típico com 6 target/scope queries:

```text
bounded concurrency = 3-6
```

Não disparar paralelismo ilimitado.

O matcher deve possuir configuração:

```text
MATCH_QUERY_MAX_CONCURRENCY
```

Valor inicial:

```text
6
```

Reduzir se houver throttling.

---

# 29. Pagination

Toda Query deve suportar `LastEvaluatedKey`.

Nenhuma implementação pode assumir:

```text
1 Query == all subscribers
```

Cada page produz candidates incrementalmente.

Isso evita carregar 100k usuários em memória antes de continuar.

---

# 30. Guardrails de aplicação

V1:

```text
max active interests/user = 100
```

Pode ser aumentado por configuração.

Rationale:

- evita abuso;
- limita delete complexity;
- mantém UX coerente;
- não é limitação estrutural.

O schema suporta mais.

---

# 31. O que fica fora do MVP

Não implementar agora:

```text
automatic partition sharding
adaptive logical shard count
subscriber counter table
DynamoDB Streams-based analytics
DAX
Global Tables
multi-region consistency
GSIs without real access pattern
materialized recommendation indexes
semantic/embedding indexes
```

---

# 32. Triggers de evolução

## Sharding

Adotar quando:

```text
single target-location > 250k subscribers
OR sustained hot-key throttling
OR p95 matcher retrieval misses SLO
```

## Subscriber counters

Adotar quando:

```text
count becomes user-facing
OR high-frequency product decision depends on it
```

## GSI

Adotar quando:

```text
new production access pattern cannot be served efficiently by existing PK/SK
```

## Provisioned capacity

Avaliar quando:

```text
traffic becomes predictable
AND measured on-demand cost materially exceeds provisioned + autoscaling alternative
```

---

# 33. Observability obrigatória

Métricas customizadas:

```text
interest_create_success
interest_create_duplicate
interest_delete_success
interest_transaction_failure
matcher_query_count
matcher_query_pages
matcher_candidates_found
matcher_candidates_deduplicated
matcher_query_latency_ms
matcher_target_partition_throttles
matcher_any_scope_ratio
```

AWS metrics:

```text
ConsumedReadCapacityUnits
ConsumedWriteCapacityUnits
ReadThrottleEvents
WriteThrottleEvents
ThrottledRequests
SuccessfulRequestLatency
SystemErrors
UserErrors
```

Alarmes iniciais:

```text
any sustained throttle > 0 for 5 min
transaction failure rate > 1%
p95 matcher query latency > 250 ms for 10 min
p95 matcher candidate retrieval > SLO
```

---

# 34. Testes obrigatórios

## Unit

```text
canonical key generation
location normalization
interestId generation
projection generation
```

## Integration

```text
create interest writes both projections
failed condition writes neither projection
remove deletes both projections
ANY and exact city queries return correct candidates
strong reads observe committed write immediately
```

## Scale

Fixtures:

```text
1k subscribers one partition
10k subscribers one partition
100k subscribers one partition
```

Validar:

```text
pagination
latency
memory
throttling
candidate deduplication
```

---

# 35. Terraform requirements

`InterestIndexTable`:

```text
billing_mode = PAY_PER_REQUEST
hash_key     = PK
range_key    = SK
PITR         = enabled in prod
server-side encryption = enabled
de deletion protection = enabled in prod
TTL          = disabled for active-interest table
```

Nome físico e tags obrigatórias conforme `../engineering/standards/resource-naming.md`.

Não criar GSI na V1.

---

# 36. Security requirements

Interest API:

```text
Read/write USER#<authenticated-user>
Write derived TARGET projection only through service role
```

Matcher:

```text
Query TARGET partitions
No write permission to UsersTable PII
```

Admin tooling:

```text
separate role
read-only by default
```

IAM policies devem ser separadas por função, com least privilege.

---

# 37. Decisões finais

```text
InterestIndexTable        dedicated table
Capacity                  on-demand
Core GSI                   none
Interest representation   two explicit projections
Create/remove              transactional
Global interest            LOCATION#ANY
Multi-city future          N match projections, same user projection
Matcher consistency        strong for explicit WORK/PERSON/ANY
Category consistency       eventual by default
Sharding                   not in MVP
Counters                   not in MVP
PII                        excluded from InterestIndexTable
```

---

# 38. ADRs recomendados

```text
ADR-003 — Interest Index DynamoDB Design

ADR-004 — Location-aware Matching and LOCATION#ANY Semantics

ADR-010 — Duplicate Projections vs GSI for Interest Access Patterns

ADR-011 — DynamoDB On-Demand Capacity for V1

ADR-012 — Hot Partition Thresholds and Sharding Evolution Path

ADR-013 — Strong Consistency for Explicit Interest Matching
```

---

# 39. Fontes técnicas verificadas

- AWS — Best practices for designing and using partition keys effectively: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-partition-key-design.html
- AWS — Data modeling building blocks / write sharding: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/data-modeling-blocks.html
- AWS — DynamoDB read consistency: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.ReadConsistency.html
- AWS — Query API consistency semantics: https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_Query.html
- AWS — DynamoDB on-demand capacity: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/on-demand-capacity-mode.html
- AWS — DynamoDB TTL: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/TTL.html
- AWS — DynamoDB pricing: https://aws.amazon.com/dynamodb/pricing/

