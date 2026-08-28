# Zero — Gauntlet da Sprint 2

**Data:** 27 de agosto de 2026  
**Resultado:** aprovado

## Evidências

- `npm run check`: format, lint, typecheck, 55 testes e verificação do pacote aprovados.
- Runtime local: macOS Apple Silicon, Node.js 26.5.0, npm 11 e Docker Desktop/Engine 29.6.1.
- Dois projetos `essential` foram criados com `zero new --config ... --yes`, ambos com `initialization.start: true`, PostgreSQL 17, migration e seed.
- Os projetos receberam portas distintas (`5432`/`3000` e `5434`/`3002`) e responderam `{"status":"ok","database":"ok"}` em `/api/health`.
- `zero status --json` reportou `db` saudável e `app` em execução nos dois namespaces.
- `zero down` no primeiro projeto encerrou somente seu namespace; o segundo permaneceu saudável. Os volumes foram preservados pelo comando e removidos apenas na limpeza explícita das fixtures temporárias.
- O estado/journal local foi mantido fora do Git e os logs de aplicação passam por sanitização de URLs, senhas, tokens e secrets.

## Escopo e ressalvas

O gauntlet cobre o perfil `essential` e o ciclo local da Sprint 2. Perfis opcionais,
comandos públicos de banco e recursos Git/GitHub permanecem deliberadamente fora
do escopo aprovado.
