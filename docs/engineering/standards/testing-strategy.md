# Estratégia de Testes

Ver `../quality-strategy.md` §2-3 para o racional completo. Este documento fixa o que é obrigatório por tipo de mudança.

## Camadas

```text
Unit         — regras determinísticas puras (scoring, normalização,
               geração de chave, token bucket)
Integration  — contra serviço real (DynamoDB Local, fila real em
               ambiente de teste) — nunca só mock quando o contrato
               real pode divergir do mock
Contract     — connector: fixture de payload real do provider →
               representação canônica esperada
E2E          — vertical slice completo (fixture → catalog → matcher →
               fake provider → assert de notificação)
Scale        — fixtures de 1k/10k/100k para o matcher (obrigatório
               antes de qualquer release que toque InterestIndexTable)
Failure      — cenários de falha explícitos do provider (429, 500,
               timeout, bloqueio) — obrigatório antes de qualquer
               release que toque o dispatcher de notificação
```

## Regra de ouro

Mock nunca substitui teste de integração real quando o componente testado é um dos dois hot paths do produto (matching, delivery). Um mock que aceita um payload que o serviço real rejeitaria é pior que nenhum teste — dá falsa confiança.

## Testes de regra de negócio nomeados

Toda regra de negócio essencial existe como teste com nome legível, não só como caso genérico dentro de uma suíte. Lista mínima obrigatória antes do primeiro release: ver `../quality-strategy.md` §3.

## Cobertura

Nenhuma meta percentual de cobertura sem `coverageThreshold` configurado e checado em CI no mesmo commit que declara a meta. Meta declarada sem enforcement é dívida disfarçada de política.

## Testes de falha obrigatórios (dispatcher)

Lista completa em `../../architecture/spec-notification-delivery.md` §57. Não reduzir escopo sem registrar a redução como decisão explícita em ADR.

## Ambiente de teste

Testes de integração rodam contra ambiente isolado (dev dedicado ou DynamoDB Local), nunca contra produção. Confirmar isolamento de rede antes de assumir que "bloqueado no browser" significa "bloqueado no servidor" — CORS não impede o servidor de processar uma requisição, só impede o browser de ler a resposta.
