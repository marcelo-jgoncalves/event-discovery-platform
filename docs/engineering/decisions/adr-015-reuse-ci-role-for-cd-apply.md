---
status: accepted
date: 2026-08-19
supersedes: [ADR-014]
---

# ADR-015 — CD Pipeline Reuses the Existing CI Role, Instead of a Second Deploy Role

Status: Accepted

## Contexto

ADR-014 introduziu uma segunda role IAM (`edp-dev-role-cd-github-actions`), separada da role de CI existente (`edp-dev-role-cicd-github-actions`, ADR-010), com o argumento de que uma role write-capable merece trust policy mais restrita que uma role plan-only. Antes do bootstrap dessa role ser aplicado, Marcelo decidiu explicitamente reverter essa parte: reusar a role de CI já existente — a mesma já usada por `ci.yml` e por `quality/scripts/audit-reality.mjs` — em vez de manter duas roles para o mesmo repositório.

## Decisão

1. **Uma única role IAM cobre CI (plan) e CD (apply)**: `edp-dev-role-cicd-github-actions`. A role de deploy separada criada em ADR-014 (`aws_iam_role.deploy` e o restante do bloco em `modules/iam-github-oidc/main.tf`) é removida antes de qualquer bootstrap — nunca chegou a ser aplicada na AWS, então não há recurso órfão para destruir.
2. **A policy `ci` (ADR-010) ganha as ações de escrita** que a policy `deploy` da ADR-014 continha (DynamoDB, Cognito, Secrets Manager, SQS, IAM `edp-*` — create/update/delete), escopadas aos mesmos tipos/prefixos de recurso de antes. O comentário original da policy ("plan-only, cresce PR a PR conforme Terraform de produto for adicionado") deixa de ser literalmente verdadeiro — atualizado no código para refletir que a role agora também aplica.
3. **`cd.yml` assume a mesma role que `ci.yml` já assume** — `secrets.AWS_ROLE_ARN_DEV`, não um secret novo. O secret `AWS_ROLE_ARN_CD_DEV` (que ADR-014 previa) nunca chega a ser criado.
4. **Trust policy não muda** — continua a de ADR-010 (qualquer ref/evento deste repositório). Isso é o trade-off explícito desta ADR: a role agora tem mais poder (apply, não só plan) com a mesma trust policy ampla que antes só protegia leitura. Aceito conscientemente por decisão do Marcelo, não uma omissão.

## Alternativas consideradas

- **Manter a role separada da ADR-014**: era a proposta original; rejeitada por decisão explícita do Marcelo antes do bootstrap acontecer — preferência por uma única role a gerenciar em vez de duas com propósitos sobrepostos (ambas já são "GitHub Actions deste repositório agindo sobre recursos `edp-*`").
- **Manter duas roles mas com a mesma trust policy** (sem o ganho de restrição que motivou a role separada em primeiro lugar): rejeitada por não ter vantagem sobre uma única role — se a trust policy não vai ser mais restrita, duas roles só adicionam superfície de gestão sem benefício de segurança correspondente.

## Consequências

- **Trade-off aceito**: qualquer PR/push/evento deste repositório que consiga rodar uma Action já assume uma role capaz de criar/alterar/destruir Cognito, DynamoDB, SQS, Secrets Manager e IAM `edp-*` — não só ler. Antes desta ADR, isso só era verdade para o workflow `cd.yml` rodando a partir de `main`. Mitigação parcial que continua de pé: branch protection de `main` (ADR-010) impede que um PR não revisado/sem Tier A verde chegue a rodar `cd.yml`; jobs de PR (`ci.yml`) continuam só fazendo `plan`, nunca `apply`, então a permissão de escrita existe na role mas não é exercida fora de `cd.yml` por desenho do próprio workflow — não por restrição de IAM.
- Simplifica o bootstrap de ADR-014 item 6: não é mais necessário nenhum apply local antes do primeiro deploy real — a policy `ci` já teria as permissões de escrita assim que este PR for mergeado e a role de CI (já existente) refletir o novo `terraform apply` que essa própria mudança de policy requer. Esse único apply (ampliar a policy da role de CI existente) ainda precisa acontecer uma vez fora da pipeline, pelo mesmo motivo de sempre: a pipeline não pode conceder a si mesma uma permissão que ainda não tem.
- `docs/engineering/decisions/adr-014-cd-pipeline-dev-apply.md` permanece no histórico, marcada `superseded`, como registro de por que a alternativa de duas roles foi considerada e depois revertida — não é reescrita.

## Trigger de revisão

Se o raio de dano de uma role com escopo tão amplo (qualquer evento do repo, permissões de escrita) se mostrar um problema real (ex.: um PR de terceiro com Actions habilitadas, ou o projeto deixar de ser solo), reavaliar a separação de roles que ADR-014 propunha — reabertura vira ADR novo, não edição desta.
