# Princípios de Engenharia

Ver `../quality-strategy.md` para a estratégia completa. Este documento fixa os princípios que orientam decisões do dia a dia — o "porquê" por trás das regras em `code-conventions.md` e `testing-strategy.md`.

## 1. Sophistication must follow observed complexity

Não construir a solução sofisticada antes do problema simples falhar de verdade. Exemplo já decidido nesta arquitetura: entity resolution começa em 2 níveis determinísticos + fila de revisão manual; fuzzy matching/IA só entram com evidência real de conflito frequente (ver `spec-dynamodb-access-patterns.md` e a decisão equivalente na V2 §3).

## 2. Build expensive-to-change decisions early; defer cheap-to-add capabilities

Caro de mudar depois: schema de dados (chaves DynamoDB, partição), contratos de evento, boundaries de domínio, modelo canônico, idempotência, tracking. Barato de adicionar depois: EventBridge como bus central, sharding, múltiplos canais de notificação, search engine dedicado. Resolver o primeiro grupo com rigor desde a V1; documentar o segundo grupo como caminho de evolução com trigger explícito, sem implementar antecipadamente.

## 3. Provider throughput is a domain constraint

Limites de terceiros (Telegram, TMDB, Ticketmaster) não são "detalhe de infraestrutura" — são parte do domínio e devem aparecer no desenho, não ser tratados via retry genérico. Ver `spec-notification-delivery.md` §3-4.

## 4. Enrichment may improve decisions but must never block core product availability

Nenhuma dependência de IA/enriquecimento pode impedir que um evento entre no catálogo ou que uma notificação seja enviada. Fallback determinístico sempre existe.

## 5. The matcher access pattern is a first-class architecture concern

"Quem se importa com este evento?" é a pergunta que decide se o produto funciona. Nenhuma mudança em `InterestIndexTable` é "só um detalhe de implementação" — passa por revisão do spec.

## 6. Honestidade sobre dívida técnica

Simplificação deliberada documenta-se com condição de evolução explícita. Gap conhecido registra-se como item de backlog com dono, não se esconde. Métrica fora da meta reporta-se com causa raiz, mesmo que a correção seja adiada. Ver `../quality-strategy.md` §12.

## 7. Auditar contra a realidade, não contra a documentação

Toda verificação de estado (segurança, infraestrutura, dependências) inclui pelo menos uma checagem executada ao vivo — rodar o comando, consultar a API, ler o config real — não apenas ler o que foi documentado como verdade.
