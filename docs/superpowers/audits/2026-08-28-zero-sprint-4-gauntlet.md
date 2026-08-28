# Zero — Gauntlet da Sprint 4

**Data:** 28 de agosto de 2026  
**Resultado:** aprovado

## Evidências

- `npm run check` aprovado: formatação, lint, typecheck, 64 testes unitários e
  validação do pacote instalado a partir do tarball.
- Gauntlet Docker materializou projetos temporários `essential` e `complete`,
  instalou dependências sem lifecycle scripts e executou `zero test --e2e`.
  Ambos concluíram com banco efêmero, migrations, seed, aplicação e health;
  `complete` também iniciou Redis, MinIO e Mailpit em portas loopback dinâmicas.
- Após cada execução, a inspeção de Docker não encontrou containers `zero-run-*`
  nem imagens `zero-build-*` restantes.
- O template agora usa scripts Prisma com ambiente injetado, `.dockerignore`,
  Dockerfile multiestágio, CI nativa e comandos `zero test`, `zero build` e
  `zero recover <run-id> --yes`.
- `zero build` construiu a imagem e executou smoke de `/api/health` em pilha
  efêmera de produção para `essential` e `complete`; a inspeção após cada teste
  não encontrou containers, redes ou imagens `zero-run-*`/`zero-build-*`.
