---
status: accepted
date: 2026-08-11
supersedes: []
---

# ADR-010 — CI/CD Foundations: GitHub OIDC Role and Tier A Pipeline

Status: Accepted

## Contexto

Phase 0 (`docs/operations/phase-0-kickoff-prompt.md`) exigia a fundação operacional do projeto antes de qualquer feature: repositório Git/GitHub, autenticação AWS para CI sem chaves estáticas, e o Tier A de `docs/engineering/quality-strategy.md` §1.1 rodando de verdade. Esta ADR registra as decisões tomadas nessa sessão que são caras de reverter ou desviam do padrão documentado originalmente.

## Decisão

1. **IAM role via Terraform, não CloudFormation.** O padrão de referência do projeto editorial (`marcelo-goncalves-blog-arquivo/docs-historico/{oidc,github-role}.yaml.txt`) usa CloudFormation. Esta role foi criada diretamente em Terraform (`infrastructure/terraform/modules/iam-github-oidc/`), reaproveitando apenas o *desenho* (trust policy via OIDC, least privilege) e o OIDC Provider já existente na conta (recurso de conta, criado uma vez, não recriado aqui). Justificativa: `quality-strategy.md` §7 exige "tudo em Terraform, nenhum recurso manual"; introduzir CloudFormation como ferramenta de IaC paralela para um único recurso não se justifica.

2. **Trust policy usa a claim `repository` + `sub` com IDs imutáveis wildcarded, não `sub` com nomes literais.** O padrão copiado do projeto editorial assumia `sub` no formato `repo:{org}/{repo}:*`. Na prática (descoberto via CloudTrail durante esta sessão), o GitHub emite `sub` no formato `repo:{org}@{ownerId}/{repo}@{repoId}:{event}` — a claim inclui IDs numéricos imutáveis. A trust policy final usa `StringEquals` na claim `repository` (formato nome, estável para leitura/auditoria) **e** `StringLike` em `sub` aceitando tanto o formato legado quanto o formato com ID (AWS exige que `sub` ou `job_workflow_ref` participe da condição; um trust policy que restringe só por `repository` é rejeitado como "not scoped to all"). Isso é uma correção de bug no padrão herdado, não uma escolha nova — o padrão do blog provavelmente nunca foi testado contra um repositório criado depois desse rollout do GitHub.

3. **Repositório público, não privado.** Branch protection completa (revisão obrigatória, `enforce_admins`, no force-push/delete) exige GitHub Pro/Team para repositórios privados em conta pessoal. Sem orçamento aprovado para upgrade nesta sessão, o repositório foi tornado público para habilitar branch protection nativa. Decisão confirmada explicitamente com o usuário antes de executar.

4. **`required_approving_review_count = 0` na branch protection de `main`.** Projeto solo (Marcelo é o único colaborador); GitHub não aceita auto-aprovação do próprio PR, então qualquer valor ≥ 1 bloquearia todo merge permanentemente. Mantido: PR obrigatório, sem push direto, sem force-push/delete, `enforce_admins=true`, conversation resolution obrigatória. Se um segundo colaborador humano entrar no projeto, este valor deve subir para ≥ 1 (trigger de revisão abaixo).

5. **Policy IAM da role de CI é escopo mínimo para plan/validate, não para apply.** Tier A desta sessão não faz `terraform apply` de recursos de produto — a policy concede apenas leitura em `edp-*` (roles/policies IAM) e leitura/escrita no state S3 do próprio projeto. Cresce PR a PR conforme Terraform de produto (DynamoDB, SQS, Lambda, API Gateway) for adicionado, nunca antecipada.

## Alternativas consideradas

- **Aplicar os templates CloudFormation literalmente** (kickoff prompt sugeria isso como passo 2): rejeitado por introduzir uma segunda ferramenta de IaC e contradizer `quality-strategy.md` §7. Os templates serviram só como referência de desenho, não como artefato a executar.
- **Deixar `main` sem branch protection até haver orçamento Pro**: rejeitado porque contradiz o requisito explícito do kickoff prompt de branch protection confirmada antes de considerar a etapa concluída — o custo de tornar o repo público (documentação/código ficam visíveis) foi julgado aceitável e foi confirmado com o usuário, contra o custo de não ter proteção nenhuma em `main` desde o primeiro commit.
- **Manter `required_approving_review_count = 1` e aprovar via token/conta secundária**: rejeitado por adicionar complexidade operacional (gerenciar uma segunda identidade) sem benefício real de revisão em um projeto de um único desenvolvedor.

## Consequências

- Repositório é público — qualquer decisão de negócio sensível (custos reais, credenciais, PII de teste) nunca pode ser commitada, nem em histórico antigo.
- A trust policy documentada aqui é a referência correta para o próximo projeto que reaproveitar este padrão — **não reaproveitar os templates CloudFormation do blog sem revisar o formato de `sub`**, esse é exatamente o bug encontrado nesta sessão.
- Branch protection sem revisão humana obrigatória depende inteiramente do CI (Tier A) como gate de qualidade — um Tier A fraco ou contornável é o único controle restante antes do merge em `main`.

## Trigger de revisão

- Se um segundo colaborador humano entrar no projeto: subir `required_approving_review_count` para ≥ 1 e reabrir esta decisão via ADR novo.
- Se o projeto obtiver GitHub Pro/Team ou decidir por outro motivo tornar o repositório privado novamente: reabrir via ADR novo (branch protection precisa ser reconfirmada nesse caminho).
- Quando Terraform de produto (DynamoDB/SQS/Lambda/API Gateway) for adicionado e a policy de CI precisar de permissões de `apply`: não é gatilho de ADR novo por si só (é crescimento incremental já previsto), mas se o pipeline evoluir para Tier B/CD com `terraform apply` automático, isso é decisão arquiteturalmente significativa e merece ADR próprio.
