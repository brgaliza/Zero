# Zero — Gauntlet da Sprint 3

**Data:** 27 de agosto de 2026  
**Resultado:** aprovado

## Evidências automatizadas

- `npm run check` aprovado: formatação, lint, typecheck, 63 testes e validação
  do pacote publicado.
- Auditoria do lock do template complete: `npm audit --package-lock-only
  --ignore-scripts --audit-level=high` sem vulnerabilidades encontradas.

## Gauntlet Docker real

- Um projeto `complete` foi criado por configuração declarativa e iniciou
  PostgreSQL, Redis, MinIO e Mailpit com portas loopback e health checks
  saudáveis.
- Prisma generate, migration, seed, bootstrap idempotente do bucket `uploads` e
  aplicação Next.js foram concluídos.
- `GET /api/health` respondeu 200 com application, database, redis, storage e
  email em estado `ok`.
- As rotas de cache, upload/listagem no MinIO e envio ao Mailpit foram
  exercitadas com êxito.
- Dois projetos `complete` com o mesmo slug foram iniciados em diretórios
  distintos e receberam namespaces e portas diferentes. `zero down` do
  primeiro preservou o segundo, que continuou saudável.

## Achados corrigidos durante o gauntlet

1. O health check `complete` tinha import relativo incorreto; corrigido antes
   da nova execução.
2. O init do MinIO usava um comando incompatível com a imagem `mc`; substituído
   por `MC_HOST_local` e `mc mb --ignore-existing`.
3. A alocação sequencial podia atribuir a mesma porta aos dois endpoints MinIO;
   a CLI passou a exigir portas distintas em cada operação.

## Ressalvas

Os diretórios temporários usados no gauntlet foram encerrados por `zero down`.
Os volumes de teste foram preservados conforme o contrato não destrutivo do
comando e não pertencem ao repositório.
