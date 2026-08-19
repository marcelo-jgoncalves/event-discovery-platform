---
status: accepted
date: 2026-08-19
supersedes: []
---

# ADR-014 — CD Pipeline: GitHub Actions Applies Dev Infrastructure, Never a Local Machine

Status: Accepted

## Contexto

`docs/backlog.md` §"Bootstrap pendente" já registrava "CD real (terraform apply automático de recursos de produto)" como decisão arquiteturalmente significativa, adiada até haver um trigger real (ver ADR-010 §5). O trigger disparou nesta sessão: Identity (Phase 1) e Catalog (Phase 2) têm Terraform pronto e validado (`infrastructure/terraform/modules/{identity,catalog}`), nunca aplicado — e o primeiro `terraform apply` real precisava acontecer para destravar Tier B (testes de integração contra Cognito/DynamoDB reais, `docs/backlog.md` linhas 90-91, 170-171).

Marcelo decidiu explicitamente: a pipeline segue o mesmo padrão já validado em produção no projeto irmão `marcelo-goncalves-blog` (`.github/workflows/cd.yml` — build/test/security-scan em paralelo, gate único de deploy, `terraform apply` via role OIDC assumida dentro do job), e **nenhum `terraform apply` de recursos de produto roda a partir de uma máquina local a partir de agora** — só a pipeline aplica.

## Decisão

1. **Nova role IAM de deploy, separada da role de CI existente.** `edp-${env}-role-cicd-github-actions` (ADR-010) é plan-only por desenho — usá-la para apply exigiria alargar o escopo de uma role que hoje só roda em todo PR de qualquer branch/evento. Em vez disso, `modules/iam-github-oidc` ganha uma segunda role, `edp-${env}-role-cd-github-actions`, com permissões de escrita (create/update/delete) escopadas aos recursos que os módulos `identity`/`catalog` de fato criam — nada além disso, mesmo princípio de `resource-naming.md` §8 e do comentário já existente na policy de CI ("cresce PR a PR, nunca antecipada").
2. **Trust policy mais restrita que a da role de CI.** A role de CI aceita qualquer ref/evento do repositório (comentário em `modules/iam-github-oidc/main.tf`: "any ref/event", adequado para plan-only). A role de deploy usa a claim `job_workflow_ref` do OIDC do GitHub para aceitar **apenas** execuções do workflow `cd.yml` a partir de `refs/heads/main` — uma role write-capable tem que ser mais estreita que uma role read-only, não igual.
3. **Trigger: push em `main` (pós-merge), mais `workflow_dispatch` manual.** Este projeto não usa branch `develop` (diferente do blog) — todo merge já passa por PR obrigatório com Tier A verde (ADR-010 §4) antes de chegar em `main`, então push em `main` já é "mudança revisada e testada", equivalente ao papel que `develop` cumpre no blog.
4. **Ambiente único por enquanto: `dev`.** `env/dev.tfvars` é o único tfvars existente; não há decisão de produção ainda (Phase 7 — Production Readiness, ainda não iniciada). `cd.yml` não tem job de deploy para `prod`.
5. **Sem smoke test HTTP.** O pipeline do blog termina com `curl`/Playwright contra URLs reais porque há frontend/API real para verificar. `services/identity`/`services/catalog` ainda não expõem handler HTTP (nenhum consumidor real além dos specs, ver `docs/backlog.md`) — o smoke test aqui é `aws cognito-idp describe-user-pool` / `aws dynamodb describe-table` via os outputs do Terraform, confirmando que os recursos existem e respondem, não que uma aplicação renderiza.
6. **Bootstrap de galinha-e-ovo: um único apply local, uma única vez, só para materializar a role de deploy.** Nenhuma pipeline pode criar sua própria relação de confiança OIDC do zero sem que *alguma* credencial já confiável exista primeiro — o próprio OIDC Provider da conta foi criado assim, uma vez, fora do Terraform deste projeto (comentário em `modules/iam-github-oidc/main.tf`). Depois deste único apply (só o módulo `iam-github-oidc`, que não cria nenhum recurso de produto), todo apply subsequente — incluindo o primeiro apply real de Identity/Catalog — roda exclusivamente via `cd.yml`.

## Alternativas consideradas

- **Reaproveitar a role de CI existente, alargando sua policy para incluir ações de escrita**: rejeitado — misturaria uma role trustada por qualquer ref/evento (apropriado para plan-only) com permissões de escrita, o oposto do princípio de least-privilege que a role de CI já documenta sobre si mesma.
- **Deploy a partir de `develop`, replicando o blog literalmente**: rejeitado — este projeto nunca adotou uma branch `develop`; introduzir uma só para espelhar o blog criaria um segundo fluxo de branch sem necessidade real, quando `main` já cumpre o mesmo papel de "estado testado e mergeado".
- **Trust policy idêntica à da role de CI (qualquer ref/evento)**: rejeitado para uma role write-capable — o raio de dano de uma role que pode criar/destruir Cognito/DynamoDB/IAM é maior que o de uma role plan-only, então a trust policy correspondente deve ser mais estreita, não copiada.

## Consequências

- A partir desta ADR, `terraform apply` de recursos de produto (`identity`, `catalog`, e módulos futuros) só acontece dentro de `cd.yml`, nunca de uma máquina local — inclusive para Marcelo. Mudança de infra passa a exigir merge em `main`, nunca `terraform apply` direto.
- A role de deploy é um novo raio de dano na conta AWS (pode criar/destruir Cognito User Pools, tabelas DynamoDB, secrets, filas SQS e roles IAM `edp-*`) — mitigado pela trust policy restrita a `cd.yml`+`main` e pelo escopo de recursos limitado ao prefixo `edp-*`/`Edp*`.
- O bootstrap de item 6 é uma exceção única e documentada, não um precedente — qualquer necessidade futura de `terraform apply` local fora desse bootstrap é, por definição, uma reabertura desta ADR, não uma exceção silenciosa.
- `docs/backlog.md` "CD real" passa de adiado para feito; os itens que dependiam de "primeiro ambiente dev implantado" (Tier B, observabilidade real, infra drift detection agendado) ficam desbloqueados assim que o primeiro apply via pipeline for confirmado.

## Trigger de revisão

Quando um ambiente `prod` for necessário (Phase 7 — Production Readiness): esta ADR não cobre promoção dev→prod, aprovação humana antes de aplicar em produção, nem uma segunda role/trust policy para esse ambiente — isso é uma decisão nova, não uma extensão mecânica desta.
