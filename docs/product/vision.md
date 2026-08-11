# Visão de Produto

Fonte: `../architecture/history/architecture-v1.md` — condensado aqui como referência rápida de produto, sem repetir o desenho técnico.

## Objetivo

Notificar usuários quando filmes, eventos, artistas, diretores, franquias, locais ou categorias de interesse se tornarem relevantes e acionáveis numa cidade. MVP: Belo Horizonte, foco em filmes e eventos, canal Telegram.

## Abstração conceitual do produto

Não é um "app de notificação de cinema". É um motor de oportunidade:

```text
USER INTEREST + REAL-WORLD EVENT + TIME/LOCATION → ACTIONABLE OPPORTUNITY
```

Hoje: "Interstellar em BH". Amanhã: shows, teatro, festivais, cursos, exposições, conferências — qualquer coisa que combine interesse pessoal com uma janela de tempo/lugar específica e acionável.

## North Star Metric (candidata)

> Monthly relevant event discoveries generated for users.

## Métricas de validação (além de cadastro)

```text
Activation        % usuários com >= 3 interesses
Precision          % notificações consideradas relevantes
CTR                notification → ticket/event page
Conversion         notification → compra de ingresso
Retention           usuário permanece inscrito?
Unsubscribe rate    quantos saem?
Notification-to-value  quantos alertas geram ação?
```

## Monetização

Primeira fonte de receita: afiliados (tracking desde o MVP — ver `../architecture/history/architecture-v1.md` §23-24). Evolução: sponsored events, planos premium, analytics B2B, distribuição para produtores.

## Fora de escopo do MVP (produto)

```text
WhatsApp, push mobile, app mobile
planos pagos, eventos patrocinados
portal de produtor
recomendação/personalização com IA
múltiplas cidades, múltiplos países
```

Cada item entra em escopo apenas com evidência de demanda real do MVP em Belo Horizonte — não antecipadamente.
