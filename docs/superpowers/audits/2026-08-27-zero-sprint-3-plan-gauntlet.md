# Zero — Gauntlet do plano da Sprint 3

**Data:** 27 de agosto de 2026  
**Artefatos:** design e plano da Sprint 3  
**Resultado:** aprovado para implementação

## Escopo da revisão

O gauntlet revisou de forma adversarial o design do perfil `complete` e seu
plano de implementação, antes de qualquer mudança funcional. Foram avaliados
isolamento, daemon Docker, alocação de portas, retomada, segredos, lifecycle,
template, testes, CI e empacotamento.

## Rodadas e resolução

| Rodada | Resultado | Achados e tratamento |
| --- | --- | --- |
| 1 | Não aprovar | 3 bloqueantes e 8 achados adicionais: namespace baseado somente em slug, corrida de portas, daemon remoto, exposição de logs, readiness, bind local, contratos de rotas, health/CI e lock. Todos foram incorporados ao plano. |
| 2 | Não aprovar | 1 bloqueante e 3 altos: garantia de Docker local imprecisa, namespace instável após mover diretório, bootstrap MinIO incompleto e comandos de workspace incorretos. Corrigidos. |
| 3 | Não aprovar | 2 altos: cópia poderia controlar o ambiente original e divergência entre design/plano sobre namespace. Corrigidos. |
| 4 | Aprovar | Nenhum achado bloqueante ou alto restante. |

## Controles confirmados no plano

- Identidade local privada e imutável, com ownership canônico obrigatório para
  todo comando operacional e relocação explícita.
- Transporte Docker Unix local confiável, validado e fixado por subprocesso;
  contextos SSH/TCP/remotos recusados.
- Atribuição de portas confirmada, recuperação atômica de colisão e testes de
  concorrência/retomada.
- Saída de subprocessos capturada, limitada e sanitizada antes de chegar a
  stdout, stderr ou logs.
- Serviços opcionais autenticados, loopback-only, health checks definidos e
  bootstrap idempotente do bucket MinIO como etapa interna.
- Readiness real da aplicação antes do sucesso de `zero up` em background.
- Contratos fechados para cache, storage, e-mail e health; CI Docker obrigatório
  para os dois profiles e gauntlet e2e obrigatório para promoção.

## Veredito

O plano está aprovado para iniciar implementação. A aprovação é de prontidão do
plano, não da Sprint 3 entregue: a implementação ainda exigirá `npm run check`,
CI com Docker e o gauntlet e2e definido no plano antes do aceite da sprint.
