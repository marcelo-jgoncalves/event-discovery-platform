---
status: done
owner: architecture
authority: historical
---

# Prompt de Kickoff — Phase 1 (Identity)

> **Executado em 2026-08-11.** Este prompt cumpriu seu papel (produzir `spec-identity.md`, ADR-012, o Terraform de Cognito/UsersTable, `services/identity` e a primeira Architecture Fitness Function + Semgrep custom rule) e agora é registro histórico do que foi pedido, não instrução ativa — não editar o corpo abaixo para refletir o que de fato aconteceu. O resultado real (o que foi implementado, decisões tomadas, itens explicitamente adiados) está em `docs/backlog.md` (seção "Phase 1 — Identity") e ADR-012.

Prompt para colar no início da próxima sessão. Phase 0 (fundação operacional — repositório, CI/CD, IAM via OIDC) está concluída e registrada em ADR-010; o sistema de enforcement de qualidade independente de IA está bootstrapado (ADR-011). Esta é a primeira sessão de **código de produto**.

---

## Prompt

Você está continuando a implementação da **Event Discovery Platform**. Existe um sistema de contexto completo e uma fundação operacional já funcionando (repositório, CI Tier A verde, IAM via OIDC). Trabalhe com autonomia máxima dentro do escopo definido abaixo: não pare para pedir confirmação em decisões já registradas nos documentos referenciados; pare apenas diante de ambiguidade genuína que nenhum documento resolve, ou antes de ações de alto impacto/irreversíveis fora do escopo já autorizado (ex: criar recursos AWS reais de custo não-trivial, expor qualquer endpoint publicamente, ou qualquer coisa fora do repositório deste projeto).

### Antes de qualquer coisa

Leia `docs/architecture/system-overview.md` (context router) e `CLAUDE.md`. Depois siga o read set "Implementar feature" definido lá, com esta lista específica para Identity:

```text
1. CLAUDE.md
2. docs/product/vision.md
3. docs/domain/glossary.md
4. docs/architecture/architecture.md — trechos que mencionam UsersTable
   (§5) e "LGPD by design" (§13)
5. docs/architecture/history/architecture-v1.md §62 (Phase 1 — Identity:
   escopo original) — histórico, não normativo
6. docs/engineering/quality-strategy.md §6 (governança de dados
   sensíveis/LGPD) e §4 (segurança)
7. docs/engineering/standards/ (principles, code-conventions,
   testing-strategy, resource-naming, git-and-review-workflow)
8. docs/engineering/quality-rules.md e quality-enforcement-system.md
   (ADR-011) — esta é a primeira sessão com código de produto real
```

**Importante:** não existe ainda `spec-identity.md` nem ADR de identidade/autenticação. `architecture.md` só menciona `UsersTable` de passagem (§5, ao listar as cinco tabelas candidatas) e "LGPD by design" como princípio geral (§13) — não há desenho de schema, fluxo de auth ou decisão sobre Cognito além do nome já usado nos exemplos de `resource-naming.md` (`edp-prod-identity-webhook-telegram`). Isso não é uma lacuna a ignorar: é trabalho desta sessão.

### Objetivo desta sessão: Phase 1 — Identity

Baseado em `docs/architecture/history/architecture-v1.md` §62, o escopo original de Phase 1 é:

```text
users
Cognito
preferences
LGPD
```

Mas "preferences" aqui é só o *registro* de que um usuário existe e pode ter preferências — não é a Phase 3 (Interests: follow movie/artist/city, matching). Não antecipar Phase 3 nesta sessão.

Escopo real desta sessão:

```text
1. Escrever spec-identity.md (docs/architecture/) cobrindo:
   - schema de UsersTable (chaves, atributos, o que é PII vs. o que não é)
   - fluxo de autenticação (Cognito: user pool, client, hosted UI vs.
     API direta — decidir e justificar, não copiar do blog sem revisar:
     o blog usa Cognito para admin único, não para usuários finais em
     volume; os requisitos são diferentes)
   - modelo de consentimento (quality-strategy.md §6: "registro
     versionado — purpose, version, grantedAt, source", não boolean solto)
   - fluxo de exclusão de conta (mesmo que o delete completo seja
     Phase 3+, o modelo de estado — ex: campo DELETING — nasce aqui
     porque é caro de adicionar depois num schema já em produção)
   - retenção de dados (decidir e documentar o número deste projeto,
     não herdar o "15 dias" do blog sem revisão — quality-strategy.md §6)

2. Formalizar como ADR (docs/engineering/decisions/, próximo número: 012)
   toda decisão cara de reverter que sair do passo 1 — especialmente
   Cognito vs. alternativa, e o schema de UsersTable (CLAUDE.md Nível 6:
   decisão arquitetural nova exige ADR antes de implementar).

3. Implementar:
   - Terraform do Cognito User Pool + Client (infrastructure/terraform/,
     seguindo resource-naming.md — componente "identity")
   - UsersTable via Terraform (nome físico derivado do nome lógico do
     spec, PascalCase prefixado Edp{Env}, conforme resource-naming.md §4)
   - Primeiro serviço real: apps/ ou services/ com o fluxo mínimo de
     signup/login (decidir a estrutura exata no spec do passo 1, não
     aqui)
   - Testes: unit para regras determinísticas do domínio de identidade;
     integration-local contra DynamoDB Local para UsersTable (mesmo
     padrão já usado no Tier A de CI — DynamoDB Local, sem mock de
     persistência)

4. Este é o primeiro código real do monorepo — ativar a primeira camada
   do sistema de enforcement (ADR-011, docs/backlog.md "Quality
   enforcement system"):
   - pelo menos uma Architecture Fitness Function real (candidata óbvia:
     nenhum módulo fora de services/identity pode importar PII de usuário
     diretamente — o mesmo princípio já aplicado ao matcher em
     spec-dynamodb-access-patterns.md, adiantado aqui porque agora existe
     o que proteger)
   - pelo menos uma Semgrep custom rule real (candidata óbvia: EDP004,
     nenhum log com PII bruta — email, telefone, nome; usar hash, mesmo
     padrão já decidido para chatId em spec-notification-delivery.md)
   - fixture inválida provando que a regra detecta a violação
     (quality-enforcement-system.md §6-7) antes de considerar a regra
     "implementada"
   - promover as regras novas para docs/engineering/quality-rules.md
     só depois de comprovadas (nunca listar como enforced antes da
     fixture passar)

5. Atualizar o pipeline de CI: os workspaces agora existem de verdade
   (não mais "0 workspaces" — scripts/run-workspaces.mjs deve passar a
   rodar checks reais). Confirmar que o Tier A continua verde com código
   real, não só com scaffolding vazio.
```

### O que fica explicitamente para depois

Não implementar nesta sessão (registrar em `docs/backlog.md` se ainda não estiver lá):

```text
Phase 2 (Catalog: TMDB/Ticketmaster, ingestion, normalização)
Phase 3 (Interests: follow, matching)
Phase 4+ (matching, Telegram, monetização, produção)
Cognito hosted UI customizada / branding — usar o padrão do provedor
  até haver razão de produto para customizar
Qualquer fluxo de exclusão de conta *completo* (o modelo de estado
  nasce aqui, a execução ponta-a-ponta pode esperar até haver dado
  real de usuário para apagar)
MFA administrativo — se adiado, registrar como decisão explícita com
  dono e prazo de revisão (quality-strategy.md §4.2), nunca como
  esquecimento
```

### Validação

Nível de risco desta sessão é alto (CLAUDE.md): toca autenticação e PII diretamente. Aplicar Nível 4 no mínimo (teste de integração + revisão de segurança dedicada) para qualquer código que manipule dados de usuário; Nível 6 (ADR formal antes de implementar) para a decisão de Cognito e o schema de UsersTable. Não declarar a sessão concluída sem essa validação, mesmo sob pressão de autonomia máxima.

### Ao final desta sessão

Atualizar `docs/backlog.md`: marcar como concluído o que foi de fato implementado, registrar o que ficou "meio feito" com nota específica do que falta. Registrar ADR(s) novos antes de encerrar, não depois de memória (mesma regra aplicada em Phase 0 — ver ADR-010/011 como exemplo de formato). Se este prompt (`phase-1-kickoff-prompt.md`, hoje na raiz do repositório) ainda estiver relevante ao final da sessão, ele deve ser movido para `docs/operations/` e marcado `status: done` / `authority: historical`, seguindo o mesmo tratamento dado a `docs/operations/phase-0-kickoff-prompt.md` — não deixá-lo solto na raiz do projeto (`CLAUDE.md`, "Contexto efêmero").
