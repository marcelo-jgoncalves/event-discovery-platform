---
status: active
owner: architecture
authority: normative
---

# Spec — Catalog (Phase 2)

Desenho do catálogo canônico: connectors TMDB/Ticketmaster, ingestion, normalização, resolução de entidade e `CatalogTable`. `architecture.md` §5 só listava `CatalogTable` de passagem; §12 (arquitetura V2) desenha o fluxo `Source Connectors → Ingestion SQS → Normalizer → Canonical Catalog`; este spec é o desenho concreto. Ver ADR-013 para as decisões caras de reverter (schema de `CatalogTable`, boundary de ingestion). Não reabre ADR-002 (entity resolution) nem ADR-006 (provider abstraction) — implementa em cima deles.

## 1. Escopo desta fase

Baseado em `history/architecture-v1.md` §~2099 (Phase 2 — Catalog: TMDB, Ticketmaster, raw ingestion, normalization, canonical catalog).

Dentro do escopo:

- contrato de provider (`ProviderConnector`) e as duas implementações (`connectors/tmdb`, `connectors/ticketmaster`);
- fluxo Ingestion SQS → normalização → `CatalogTable`;
- schema de `CatalogTable` (`Work`, `Event`, título como índice, review queue);
- evento de domínio `catalog.event.normalized.v1`;
- resolução de entidade de nível 1 (ID externo forte — trivial, é o próprio ID do provider) e nível 2 (regra composta — título normalizado) conforme ADR-002.

Fora do escopo (ver `docs/backlog.md`):

- Matching / `InterestIndexTable` (Phase 3) — este spec produz o catálogo que a Phase 3 vai consumir, não consome interesses de usuário;
- consumo/limpeza da review queue de itens `UNRESOLVED` (Phase 3+, quando existir um operador/processo real para revisar);
- AI enrichment (ADR-005 existe, implementação é de uma phase posterior);
- S3 Raw Archive (`architecture-v1.md` §10) — decisão consciente de adiar: o normalizador processa o payload em memória a partir da mensagem SQS; sem archive persistente ainda, porque não há hoje um caso de replay/reprocessamento real que justifique o custo operacional de um bucket + lifecycle policy antes do primeiro incidente que precise dele (`architecture.md` §18 princípio: sofisticação segue complexidade observada). Registrado em `docs/backlog.md`, não esquecido;
- scraping ou qualquer fonte além de TMDB/Ticketmaster;
- coleta incremental sofisticada (cursor/watermark/hash de payload — `architecture-v1.md` §9): esta fase faz coleta simples (janela de tempo fixa), sem cursor persistido. Adiado, registrado em `docs/backlog.md`.

## 2. Onde o código vive

```text
packages/provider-contracts/   tipos compartilhados: ProviderConnector, RawSourceEvent
connectors/tmdb/                TMDB HTTP client + ProviderConnector, zero lógica de domínio
connectors/ticketmaster/        Ticketmaster HTTP client + ProviderConnector, zero lógica de domínio
services/catalog/               normalização, resolução de entidade, persistência em CatalogTable
```

`services/catalog` (não `services/ingestion`) — a normalização, resolução de entidade e persistência formam um único bounded context ("Catalog", já nomeado em `architecture.md` §5/§12); não há um segundo consumidor da fila de ingestion hoje que justifique separar "ingestion" como serviço próprio (YAGNI — `architecture.md` §18).

## 3. Provider contract (ADR-006)

```typescript
// packages/provider-contracts/src/index.ts
interface RawSourceEvent {
  source: 'tmdb' | 'ticketmaster';
  externalId: string;
  fetchedAt: string; // ISO 8601
  payload: unknown;  // provider's own JSON shape, opaque to the domain
}

interface CollectionResult {
  events: RawSourceEvent[];
}

interface ProviderConnector {
  source(): 'tmdb' | 'ticketmaster';
  collect(): Promise<CollectionResult>;
}
```

Isso é exatamente `EventSourceConnector` de `history/architecture-v1.md` §7, com `source()`/`collect()`; `cursor`/`CollectionCursor` fica de fora nesta fase (§1 — coleta incremental adiada). `RawSourceEvent.payload` é `unknown` — o normalizador em `services/catalog` é o único lugar autorizado a interpretar a forma específica do provider (ADR-002 "anti-corruption layer"); os connectors nunca decodificam o payload em campos de domínio, só o repassam.

## 4. Ingestion — fila SQS

```text
edp-{env}-ingestion       (resource-naming.md §5)
edp-{env}-ingestion-dlq
```

Uma fila compartilhada pelos dois providers (ADR-013 §4) — a mensagem carrega `RawSourceEvent` serializado (`source` identifica o provider, o normalizador despacha por esse campo). `maxReceiveCount = 5` antes de mover para a DLQ (mesma convenção geral de `quality-strategy.md`/ADR-007 idempotency — reprocessar uma normalização é seguro porque `PutItem` sobre a mesma chave é idempotente por natureza).

Fluxo:

```text
TmdbConnector / TicketmasterConnector
        ↓ (collect())
   Ingestion SQS
        ↓
   services/catalog normalizer
        ↓
     CatalogTable
        ↓ (evento de domínio)
catalog.event.normalized.v1
```

Não há Lambda/scheduler de invocação automática dos connectors nesta fase (isso é um detalhe de deploy/CD, adiado junto com Tier B — `docs/backlog.md` "Bootstrap pendente"); `collect()` e o normalizador são funções chamáveis, testadas isoladamente, prontas para serem invocadas por um scheduler quando ele existir.

## 5. CatalogTable

Ver ADR-013 para a justificativa completa. Chaves:

```text
PK = WORK#<namespace>:<id>          SK = METADATA
PK = EVENT#<namespace>:<id>         SK = METADATA
PK = WORKTITLE#<normalizedTitle>    SK = WORK#<namespace>:<id>
PK = REVIEW#UNRESOLVED              SK = EVENT#<namespace>:<id>
```

`<namespace>:<id>` é o Canonical Target ID de ADR-002 (`WORK#tmdb:157336`, `EVENT#ticketmaster:vvG1zZa4e...`).

### 5.1 Item `Work` (`SK = METADATA`)

```text
canonicalId       string   — "WORK#tmdb:157336"
type              string   — "MOVIE" (único tipo de Work nesta fase; Play/
                              ConcertTour/Franchise de history-v1.md §12
                              ficam para quando um provider real os alimentar)
title             string
normalizedTitle   string   — lowercase, sem diacríticos/pontuação (§7)
originalTitle     string
releaseDate       string?  — ISO 8601 date
overview          string?
source            string   — "tmdb"
sourceId          string   — id bruto do provider (TMDB movie id)
createdAt         string
updatedAt         string
```

### 5.2 Item `Event` (`SK = METADATA`)

```text
canonicalId       string   — "EVENT#ticketmaster:vvG1zZa4e..."
type              string   — "SCREENING" | "CONCERT" | "OTHER" (mapeado da
                              classificação do Ticketmaster; ver §7)
title             string
venueId           string?  — Ticketmaster venue id, sem tabela própria de
                              Venue nesta fase (fora do escopo — sem
                              access pattern próprio ainda, architecture.md §18)
cityName          string?
startAt           string   — ISO 8601
status            string   — "onsale" | "offsale" | "cancelled" |
                              "postponed" | "rescheduled" (direto do
                              Ticketmaster; sem normalização de vocabulário
                              própria nesta fase)
workId            string?  — canonicalId de um Work, se resolvido (§7)
resolutionStatus  string   — "RESOLVED" | "UNRESOLVED" | "NOT_APPLICABLE"
source            string   — "ticketmaster"
sourceId          string
createdAt         string
updatedAt         string
```

Nenhum GSI (ADR-013 — `WORKTITLE#*`/`REVIEW#*` são itens companheiros na mesma partição/tabela, não índices).

## 6. Evento de domínio `catalog.event.normalized.v1`

Formato conforme `architecture.md` (linha ~191-210), aplicado ao Catalog:

```json
{
  "eventType": "catalog.event.normalized.v1",
  "eventId": "01J...",
  "occurredAt": "2026-08-12T12:30:00Z",
  "correlationId": "01J...",
  "source": "ticketmaster",
  "data": {
    "canonicalEventId": "EVENT#ticketmaster:vvG1zZa4e...",
    "resolutionStatus": "RESOLVED"
  }
}
```

Emitido depois que o item é persistido em `CatalogTable`. Nesta fase, sem consumidor real (Matcher é Phase 3) — o formato existe como contrato estável desde já (`architecture.md` "Eventos de domínio continuam existindo como contratos"), publicado via `console.log` estruturado (mesmo padrão de "sem EventBridge ainda" da V1) até existir um segundo consumidor real que justifique uma fila/tópico dedicado.

## 7. Normalização e resolução de entidade (ADR-002)

### 7.1 TMDB → `Work`

Determinístico, sem resolução necessária: o `canonicalId` é o próprio ID do provider (`WORK#tmdb:<movie_id>`) — nível 1 de ADR-002 ("ID externo forte"). `normalizedTitle` = título em minúsculas, diacríticos removidos (NFD + strip de marcas de combinação), pontuação removida, espaços colapsados — usado só como chave de lookup para o passo seguinte, nunca exibido ao usuário.

### 7.2 Ticketmaster → `Event`

`canonicalId` também é nível 1 (`EVENT#ticketmaster:<event_id>`). O que precisa de resolução é o vínculo opcional `workId` (histórico: "separação entre WORK e EVENT", `architecture-v1.md` §12):

```text
SE classification do Ticketmaster indica "Film"/cinema:
    normalizar o título do evento (mesma função de §7.1)
    buscar Work por Query PK = WORKTITLE#<normalizedTitle>
    SE exatamente 1 resultado:
        workId = esse Work; resolutionStatus = RESOLVED
    SENÃO (0 ou >1 resultados — ambíguo):
        workId = undefined; resolutionStatus = UNRESOLVED
        escrever item companheiro PK=REVIEW#UNRESOLVED (§5)
SENÃO (concerto/outro — não é sessão de filme):
    workId = undefined; resolutionStatus = NOT_APPLICABLE
```

Isso é exatamente o "nível 2 — regra composta" de ADR-002, restrito ao único sinal disponível hoje (título normalizado). Sem fuzzy matching, sem IA (ADR-002 explícito). A função de resolução é pura — recebe o evento normalizado e a lista de `Work` candidatos já buscados, devolve `{ workId?, resolutionStatus }` — nenhuma chamada de rede dentro da função de decisão, só na camada de aplicação que busca os candidatos.

## 8. O que fica para Phase 3+ (não implementado aqui)

```text
Matching (Interest Index, Matcher)                  → Phase 3
Consumo/limpeza da review queue REVIEW#UNRESOLVED    → Phase 3+
Entity resolution fuzzy/IA (nível 3-4 de ADR-002)    → trigger: ADR-002
Venue como entidade própria                          → quando um access
                                                         pattern real precisar
S3 Raw Archive / replay                               → quando houver
                                                         incidente real que
                                                         precise de replay
Coleta incremental (cursor/watermark/hash)            → quando volume real
                                                         justificar
AI Enrichment                                          → ADR-005, phase própria
```

## 9. Testes

- **Unit** (`services/catalog/test/unit/`): normalização TMDB→Work e Ticketmaster→Event (determinísticas, sem I/O), `normalizeTitle`, `resolveWorkForEvent` (pura — candidatos passados como argumento, sem repositório).
- **Integration-local** (`services/catalog/test/integration/`): contra DynamoDB Local, mesmo padrão de `services/identity` — grava/lê `Work`/`Event`/`WORKTITLE#*`/`REVIEW#UNRESOLVED` reais.
- Connectors (`connectors/tmdb`, `connectors/ticketmaster`): unit test do parsing de resposta HTTP para `RawSourceEvent` com um fixture de payload gravado (sem chamada de rede real nesta fase — sem ambiente `dev`/credenciais reais para um teste de integração contra a API real; fica para Tier B, `docs/backlog.md`).
