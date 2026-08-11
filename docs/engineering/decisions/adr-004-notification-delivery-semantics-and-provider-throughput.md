---
status: accepted
date: 2026-08-11
supersedes: []
---

# ADR-004 — Notification Delivery Semantics and Provider Throughput

Status: Accepted

Consolida: prioridade/scheduling, safe throughput ceiling, concorrência SQS/Lambda, tratamento de 429, semântica de delivery ambíguo e quiet hours — decisões que mudam juntas porque governam o mesmo dispatcher.

## Contexto

Throughput do Telegram é finito e documentado (~30 msg/s broadcast, ~1 msg/s por chat privado, ~20 msg/min em grupo); notificações têm urgência diferente; `sendMessage` não garante exactly-once. Detalhe completo: `../../architecture/spec-notification-delivery.md`.

## Decisão

- **Provider throughput é domain constraint**, não erro de infraestrutura. Ceiling interno: 28 msg/s global (margem sobre os 30 documentados), 1 msg/s por chat privado, 20 msg/min por grupo — validado continuamente em runtime (`telegram_429_count`, `retry_after`), com ajuste manual se 429 aumentar mesmo abaixo do ceiling (auto-tuning fora do MVP).
- **Três filas de prioridade** (HIGH/NORMAL/LOW) com scheduling ponderado 70/20/10 e empréstimo de cota — rejeitado drenar HIGH por completo antes de NORMAL (risco de starvation). P0 (pré-venda em alvo seguido)/P1 (match exato) → HIGH; P2 (relação) → NORMAL; P3 (categoria/recomendação) → LOW.
- **Concorrência calculada a partir de latência real estimada**, não valor arbitrário: MVP `reservedConcurrency=8` (HIGH 4/NORMAL 2/LOW 2, ≈26.7 attempts/s a 250-300ms/chamada, abaixo do ceiling); Growth `reservedConcurrency=12` (HIGH 6/NORMAL 4/LOW 2) — aumenta headroom, não o ceiling do provider. Regra: `reservedConcurrency >= sum(maximumConcurrency das filas)`.
- **429 é backpressure esperado**, não bug: parse de `retry_after`, requeue durável com jitter, sem retry storm. DLQ é para falha permanente/poison, não para throttling normal.
- **Exactly-once não é garantido.** Política: preferir suprimir duplicata a reenviar agressivamente resultado ambíguo; estado `DELIVERY_UNKNOWN` de primeira classe, sem reenvio automático imediato.
- **Quiet hours**: `SQS DelaySeconds` não serve para atraso longo. Notificação em quiet hours vira `DEFERRED` com `deliverAfter`; releaser agendado (EventBridge Scheduler aceitável aqui, não reintroduz EventBridge como domain bus) libera na janela permitida com jitter determinístico (evita thundering herd às 08:00); P0 urgente não recebe jitter artificial.

## Alternativas consideradas

Confiar só no limite documentado sem margem/validação em runtime — rejeitado. Drenar HIGH por completo antes de NORMAL/LOW — rejeitado (starvation). Scheduler centralizado com fairness estrita — adiado até evidência de que a aproximação por concorrência é insuficiente. Retry automático de todo resultado ambíguo — rejeitado (risco de duplicar entrega). `SQS DelaySeconds` direto para todo atraso — rejeitado (não suporta atraso longo confiável).

## Consequências

Throughput máximo do sistema é limitado pelo provider (10k mensagens ≈ 6min, 100k ≈ 1h a 28 msg/s) — isso define o SLO de burst, não uma escolha interna. Uma fração pequena de mensagens pode ficar `DELIVERY_UNKNOWN` sem reenvio — aceito e monitorado.

## Trigger de revisão

Necessidade de throughput de burst maior que o limite gratuito sustenta → avaliar Telegram Paid Broadcasts. Evidência de starvation de LOW/NORMAL ou HIGH sem latência controlada → scheduler centralizado. UX passar a depender de ordenação → FIFO por usuário.
