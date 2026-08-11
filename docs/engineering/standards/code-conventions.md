# Convenções de Código

Aplica-se a todo código deste monorepo (`apps/`, `services/`, `connectors/`, `packages/`). Convenções de linguagem/framework específicas (ex: regras de ESLint por workspace) vivem no `eslint.config.mjs` de cada workspace — este documento fixa o que deve ser verdade em todos eles, para manter consistência.

## Linguagem

TypeScript/Node.js em todos os workspaces da V1 (ver `../../architecture/history/architecture-v1.md` §46, histórico). Python é aceitável no futuro apenas para processamento específico de IA — não introduzir uma segunda linguagem de propósito geral sem ADR.

## Idioma

Identificadores, comentários, mensagens de commit: inglês. Copy/dados voltados a usuário final: português. Ver `../../../CLAUDE.md`.

## Tipagem

- TypeScript strict em todo workspace novo, desde o primeiro commit.
- Nenhum `as X` sem justificativa em comentário — cast é sinal de fronteira não validada. Toda fronteira externa (payload de connector, resposta do DynamoDB, body de request HTTP) valida com schema (Zod ou equivalente) antes de tipar como domínio. Isso é decisão herdada de um gap real identificado no histórico do projeto anterior: casts como `result.Item as Post` substituindo validação nas fronteiras.
- `any` proibido por lint, exceto em arquivo de teste com justificativa.

## Contratos compartilhados

Todo tipo de domínio usado por mais de um workspace (`Post`, `CanonicalEvent`, `NotificationCandidate`, etc.) vive em `packages/contracts/`, nunca duplicado/redefinido em cada workspace. Validação em runtime via schema, não apenas tipo estático — payload inválido nunca segue silenciosamente adiante no pipeline.

## Lint

Type-aware linting (`typescript-eslint` com informação de tipo) obrigatório no backend/services. Regra recomendada no frontend: proibir valor de estilo hardcoded fora do design token (herdada do projeto anterior, evita drift visual silencioso).

## Erros

- Nunca `catch (error: any)` genérico copiado sem tratamento — classificar o erro (retryable vs permanente vs desconhecido) explicitamente, especialmente em connectors e no dispatcher de notificação (ver `ProviderSendResult` em `spec-notification-delivery.md` §50).
- Nunca vazar mensagem de exceção interna para resposta de API pública — mapear para mensagem genérica, logar detalhe internamente com `correlationId`.

## Build e runtime

- Build deve rodar typecheck real (`tsc --noEmit`), não apenas transpilar — gap identificado no histórico do projeto anterior (esbuild só transpilando sem checar tipos).
- Dependências nativas (ex: Sharp) sempre em `dependencies`, nunca em `devDependencies`, se usadas em runtime de produção.
- Lockfile é fonte de verdade; nenhuma resolução de versão transitória não determinística em runtime de Lambda.

## Comentários

Ver `../../../CLAUDE.md` — regra "why not what".

## Estrutura de pastas

Seguir o layout definido em `README.md` da raiz (`apps/`, `services/`, `connectors/`, `packages/`, `infrastructure/`, `docs/`). Novo serviço só nasce como pasta própria em `services/` quando o domínio já está claro — não criar serviço vazio "para o caso de precisar".
