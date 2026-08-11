---
status: active
owner: architecture
authority: normative
---

# Domain Glossary

Vocabulário canônico deste projeto. Se um termo tem significado específico no domínio, a definição vive aqui — specs e código **usam** o termo, nunca o redefinem com outra palavra ou outro sentido.

Regra: variações como `event`/`occasion`/`show`/`screening`/`session`/`movieEvent` não são sinônimos livres — cada uma, se existir, tem um significado específico e único definido abaixo. Nomear algo fora deste glossário sem atualizar o glossário é dívida técnica.

---

## Work

Entidade cultural abstrata que pode originar eventos concretos. Não tem hora, local ou sessão — é o "conceito", não a "ocorrência".

```text
Examples:
  Interstellar
  The Lord of the Rings
  Hamlet

Not:
  Interstellar at Cineart Boulevard, 20:30
  → isso é um Event/Screening, não um Work.
```

Subtipos previstos (ver `architecture.md` §12): `Movie`, `Play`, `ConcertTour`, `Franchise`.

## Event

Ocorrência concreta de um Work (ou de uma categoria/performer) num tempo e local específicos. Todo Event tem `startAt`, `endAt`, `timezone`, `venueId`, `cityId`.

Subtipos previstos: `Screening` (sessão de filme), `Concert`, `Festival`, `Performance`. `Screening` é o subtipo de `Event` usado especificamente para exibição de filme — não usar "Event" genérico quando o subtipo correto é conhecido.

## CanonicalEvent

Representação de um `Event` já normalizada pelo anti-corruption layer, livre de qualquer formato específico de provider (nunca contém campo tipo `ticketmasterEventId`). É o que o domínio manipula depois da ingestão — nunca o payload bruto do connector.

## Target

O que um usuário pode seguir através de um `Interest`: um `Work`, uma `Person` (artista/diretor/performer) ou uma `Category`. Representado com Canonical Target ID no formato `<TYPE>#<namespace>:<id>` (ex: `WORK#tmdb:157336`) — ver ADR-002.

## Interest

Registro de que um usuário quer ser notificado sobre um `Target`, com um `LocationScope` associado. Um usuário tem N interests. Ver `spec-dynamodb-access-patterns.md` para o modelo de dados completo (Match Projection + User Projection).

## LocationScope

Escopo geográfico explícito e obrigatório de um `Interest`. Valores V1: `CITY#<canonical-city-id>` ou `ANY`. Nunca representado como cidade nula/ausente/string vazia — "seguir em qualquer lugar" é um valor de primeira classe (`ANY`), não a ausência de valor. Ver ADR-003 e ADR-004 (consolidado).

## ResolutionStatus

Estado de entity resolution de um `CanonicalEvent`/`Work` recém-normalizado: `RESOLVED`, `UNRESOLVED`, `MANUALLY_RESOLVED`, `IGNORED`. `UNRESOLVED` não bloqueia o evento de entrar no catálogo — vai para review queue. Ver ADR-002.

## EnrichmentStatus

Estado do enriquecimento assistido por IA de um `CanonicalEvent`: `NOT_REQUIRED`, `PENDING`, `COMPLETED`, `FAILED`, `EXPIRED`. Nunca bloqueia disponibilidade do catálogo — ver ADR-005.

## NotificationCandidate

Saída do matcher: um par `(userId, canonicalEventId)` com score/reason, antes de passar pela `NotificationPolicy` e virar uma notificação de fato enfileirada. Não confundir com `Notification` (que já tem estado de entrega — ver `spec-notification-delivery.md` §49, lifecycle).

## Offer

Modelo abstrato de oferta de um parceiro de afiliação (`provider`, `originalUrl`, `affiliateUrl`, `price`, `currency`, `availability`, `commissionModel`). Nunca acoplado a regra de negócio específica de um provider. Ver ADR-008.

## NotificationPolicy

Configuração por usuário/canal que decide se e quando uma notificação é enviada: `quietHours`, `dailyLimit`, `minScore`. Aplicada pelo Notification Planner antes de qualquer mensagem entrar numa fila de prioridade.

---

## Termos que não existem neste projeto (evitar)

```text
"session"    → use Screening (subtipo de Event)
"occasion"   → não usar; ou Event ou Work, nunca os dois ao mesmo tempo
"subscriber" → use "user com Interest ativo"; "subscriber" sugere um
               modelo de assinatura que não existe no domínio
```

Se um termo novo for necessário, adicionar aqui antes de usá-lo em spec/código — não introduzir vocabulário novo implicitamente através de nome de variável ou tabela.
