# Zero — Gauntlet do plano da Sprint 4

**Data:** 27 de agosto de 2026  
**Artefatos:** design e plano da Sprint 4  
**Resultado:** aprovado para implementação

## Escopo da revisão

Uma auditoria independente e adversarial revisou design, plano e código atual
antes de qualquer implementação da Sprint 4. Foram examinados trust boundary,
Docker local, Compose, contexto de build, migrations, isolamento, cleanup,
redaction, recuperação, portas, CI, gate e distribuição.

## Rodadas e resolução

| Rodada | Resultado | Achados e tratamento |
| --- | --- | --- |
| 1 | Não aprovar | 5 bloqueantes e 6 altos: barreira Docker ausente, Compose/scripts não confiáveis, semântica ambígua do e2e, contexto de build com secret e waiver sem autoridade. Corrigidos com barreira antecipada, definição interna, trust boundary, contexto por allowlist e gate verificável. |
| 2 | Não aprovar | 2 bloqueantes e 4 altos: scripts podiam ler `.env.local` persistente e recuperação por run-id era teórica; migrations runtime, Dockerfile, labels e grafo do gate estavam incompletos. Corrigidos com injeção explícita de ambiente, `zero recover`, estágio de migration, política de Dockerfile, labels por recurso e `if: always()`. |
| 3 | Não aprovar | 1 bloqueante e 2 altos: template CI não tinha CLI instalável, intenção privada não era durável e bind host/container era ambíguo. Corrigidos ao separar CI nativa do template da CI do Zero com tarball, especificar intenção privada atômica e separar bind interno de publicação loopback. |
| 4 | Aprovar | Nenhum bloqueante ou alto restante. |

## Controles confirmados no plano

- Barreira Docker Unix local, canônica e não-symlink antes de todos os comandos
  operacionais, inclusive legados; endpoint validado é fixado por subprocesso.
- E2e/build não interpretam Compose nem infraestrutura do projeto: usam pilha
  interna, allowlists, imagens por digest, labels e portas dinâmicas loopback.
- Scripts de migration, seed e app recebem ambiente efêmero e não leem
  `.env.local` implicitamente; há teste com sentinela do ambiente persistente.
- Contexto de build por allowlist exclui estado/segredos; imagem runtime e etapa
  de migration são separadas.
- Recursos são rastreados por intenção privada, `run-id` e labels; cleanup e
  recuperação manual são restritos, confirmados e não tocam recursos vizinhos.
- Redaction incremental antecede log, JSON e limite de saída; corpus cobre
  secrets divididos entre chunks.
- CI do template é executável sem CLI publicada; CI do Zero instala o próprio
  tarball e tem `release-gate` com semântica explícita de waiver autorizada.

## Veredito

O plano é considerado muito bom e está aprovado para desenvolvimento. Esta
aprovação vale para a prontidão do plano; o aceite da Sprint 4 continua exigir
implementação, `npm run check`, pacote, CI Docker e gauntlet e2e definidos.
