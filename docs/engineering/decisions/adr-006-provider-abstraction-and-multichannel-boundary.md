---
status: accepted
date: 2026-08-11
supersedes: []
---

# ADR-006 — Provider Abstraction and Multi-channel Boundary

Status: Accepted

Consolida: contrato genérico de provider (fontes de dados e canais de notificação) e a fronteira entre o que é reutilizável entre canais vs. específico de cada um.

## Contexto

Fontes de dados (TMDB, Ticketmaster, futuros) e canais de notificação (Telegram, futuros Email/WhatsApp/Push) devem evoluir sem redesenho do domínio. Detalhe: `../../architecture/history/architecture-v1.md` §7/§19 (histórico), `../../architecture/spec-notification-delivery.md` §48/§51-53.

## Decisão

Dois contratos genéricos: `EventSourceConnector` (`source()`, `collect(cursor)`) para fontes de dados; `NotificationProvider` (`providerId()`, `validateChannel()`, `send()`, `classifyError()`) para canais. Tudo específico de provider (payload, credenciais, rate limit, parsing de erro) isolado na implementação do provider. **Genérico e reutilizável entre canais**: Notification Planner, `NotificationPolicy`, idempotência, modelo de prioridade, lifecycle de notificação, tracking, convenções de métrica. **Específico por canal, nunca compartilhado**: rate limiter, dispatcher, parsing de erro do provider, formato de payload, credenciais — cada canal novo ganha seu próprio dispatcher e limiter, nunca reutiliza o limiter do Telegram.

## Alternativas consideradas

Acoplar lógica de negócio ao formato de cada provider — rejeitado, inviabiliza adicionar provider sem tocar o domínio. Rate limiter único genérico entre canais — rejeitado: limites de provider são fundamentalmente diferentes (ex: regras de template/conversa do WhatsApp não existem no Telegram).

## Consequências

Migração para novo canal/fonte reutiliza a maior parte do pipeline; adicionar canal é trabalho aditivo, não reescrita do core.

## Trigger de revisão

Nenhum — contrato estrutural.
