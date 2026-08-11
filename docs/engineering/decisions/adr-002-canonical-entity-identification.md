---
status: accepted
date: 2026-08-11
supersedes: []
---

# ADR-002 — Canonical Entity Identification

Status: Accepted

## Contexto

Múltiplos providers (TMDB, Ticketmaster, futuros) representam a mesma entidade de formas diferentes. O domínio não pode vazar formato específico de provider. Detalhe: `../../architecture/history/architecture-v1.md` §11-13 (histórico — desenho já incorporado à arquitetura vigente).

## Decisão

Modelo canônico (`CanonicalEvent`, `Work`) com anti-corruption layer — connectors traduzem para `RawSourceEvent` e depois para o modelo canônico; nenhum campo específico de provider (`ticketmasterEventId`) circula pelo domínio. Canonical Target ID no formato `<TYPE>#<namespace>:<id>` (ex: `WORK#tmdb:157336`) — o namespace faz parte do identificador, IDs de providers diferentes nunca são tratados como equivalentes por acidente. Entity resolution em 2 níveis determinísticos (ID externo forte, depois regra composta) + estado `UNRESOLVED` explícito com review queue — sem fuzzy/IA na V1.

## Alternativas consideradas

Entity resolution com 4 níveis (determinístico, regras, fuzzy, IA) desde a V1 — rejeitado por ser mais sofisticado que o problema atual (só TMDB + Ticketmaster) exige.

## Consequências

Menos código/complexidade na V1; casos ambíguos ficam explicitamente marcados em vez de resolvidos automaticamente com confiança falsa.

## Trigger de revisão

Volume real de itens `UNRESOLVED` na review queue justificando automação (fuzzy matching) com evidência, não suposição.
