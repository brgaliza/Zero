# Zero — Design da Sprint 4: confiabilidade e validação de release

**Status:** proposto em 27 de agosto de 2026  
**Dependência:** Sprint 3 aprovada

## Objetivo

Fechar a validação local e automatizada de projetos gerados pelo Zero. Um
projeto recém-criado, nos perfis `essential` e `complete`, deve poder executar
testes rápidos, validar a pilha Docker real e construir uma imagem de produção
com smoke test isolado, sem alterar o ambiente de desenvolvimento nem expor
segredos. A mesma matriz deve proteger push e pull request na CI.

## Escopo

### Incluído

- `zero test` para a validação rápida do projeto atual.
- `zero test --e2e` para validação Docker real, isolada e profile-aware.
- `zero build` para build da imagem de produção e smoke test de health em
  pilha temporária e privada.
- Testes e proteções de cleanup, isolamento e sanitização de saída.
- Workflow GitHub Actions do template, com matriz dos perfis `essential` e
  `complete` e job que requer Docker.
- Validação de pacote da CLI e varredura de segredos em artefatos e saídas
  controladas.

### Fora do escopo

- Publicação de imagem, deploy, infraestrutura de nuvem ou credenciais remotas.
- Git, GitHub CLI, criação de repositório ou push automatizado.
- `zero context`, `zero db`, exemplos CRUD ou mudanças de perfil.
- Novos serviços, dependências de produto ou alteração do contrato dos perfis.
- Exclusão de volumes ou dados do ambiente de desenvolvimento.

## Contrato de comandos

### `zero test`

Executa a suíte rápida declarada pelo template: lint, typecheck e testes
unitários. A CLI valida propriedade local e manifesto antes de iniciar
subprocessos, usa argumentos fixos e retorna diagnóstico sanitizado. Não inicia
Docker, não instala dependências e não modifica arquivos do projeto.

`zero test --e2e` inclui a suíte rápida e, em seguida, executa o teste de
integração real. Ele usa namespace, rede, portas e diretório temporários
derivados de um identificador aleatório; nunca reutiliza a identidade local do
projeto nem o estado de `zero up`. Para `essential`, valida banco, migration,
seed, aplicação e health. Para `complete`, valida também Redis, MinIO e Mailpit
e os exemplos de cache, storage e e-mail. Recursos temporários são removidos em
sucesso, falha, sinal de interrupção e timeout; volumes locais existentes não
são selecionados nem removidos.

### `zero build`

Constrói a imagem de produção a partir do diretório atual com tag temporária e
imutável. Depois inicia uma pilha isolada, aplica migrations contra PostgreSQL
temporário e consulta `GET /api/health` até o limite de tempo. No perfil
`complete`, a pilha inclui os serviços habilitados e valida a forma pública do
health check; exemplos funcionais continuam cobertos por `--e2e`.

Toda imagem, container, rede, volume e arquivo temporário criado pelo comando
recebe identificador exclusivo e é removido na finalização. O comando não usa
`zero down`, não toca no namespace persistente e não publica a imagem. Em falha,
mostra apenas etapa, causa sanitizada e ação de recuperação.

## Arquitetura de validação

Uma camada compartilhada no núcleo da CLI modela uma execução temporária:

- gera identificador e nomes Docker fora do namespace do projeto;
- fixa o transporte Docker local já validado e os argumentos permitidos;
- registra somente metadados não sensíveis para permitir cleanup no processo;
- instala handlers de `SIGINT` e `SIGTERM`, timeout e `finally` idempotente;
- aplica redaction aos resultados de subprocesso antes de qualquer renderização.

Os adaptadores de `test` e `build` declaram somente os serviços esperados pelo
manifesto validado. Não recebem nomes de container, portas, imagem ou serviço
do usuário. A camada rejeita qualquer resultado Compose que contenha serviço
fora da allowlist do profile.

## Template e CI

O template inclui scripts separados e estáveis para qualidade rápida, testes
unitários e e2e. O workflow em `.github/workflows/ci.yml` executa:

1. qualidade, typecheck e testes unitários;
2. build e verificação do pacote Zero;
3. matriz Docker que materializa `essential` e `complete`, executa `zero test
   --e2e` e `zero build` e preserva logs sanitizados apenas quando o job falhar.

A execução Docker é obrigatória para promoção de release. Se uma exceção
temporária for necessária, ela exige waiver humano versionado, motivo, data de
expiração e bloqueio explícito do gate de release; a ausência ou expiração do
waiver falha o gate. O workflow não exige login, token de cloud ou segredo
permanente.

## Segurança e falhas

- Nenhum comando imprime `.env.local`, `compose config`, argumentos contendo
  credenciais, URLs autenticadas ou logs sem redaction.
- A tag da imagem, recursos temporários e arquivos de log não contêm valores de
  segredo; logs têm tamanho limitado.
- A falha de cleanup é reportada separadamente, com identificadores seguros e
  comando de recuperação limitado aos recursos temporários, sem mascarar a
  falha original.
- Operações destrutivas futuras permanecem indisponíveis nesta sprint. A base de
  confirmação explícita só será introduzida quando um comando destrutivo for
  especificado, evitando uma opção sem comportamento real.
- Timeouts, ausência de Docker, daemon remoto, health `503`, migration falha e
  interrupção do usuário retornam erro recuperável e não indicam êxito parcial.

## Testes e aceite

- Testes unitários cobrem parser de argumentos, seleção profile-aware, argv
  permitido, redaction, timeout e cleanup idempotente.
- Testes de integração controlada provam que `zero test` não modifica o projeto
  e que `--e2e`/`build` não usam namespace, portas ou volumes do ambiente local.
- Em Docker real, cada perfil é materializado do tarball, passa testes rápidos,
  `zero test --e2e` e `zero build`; dois projetos em execução continuam
  inalterados durante essas validações.
- A CI executa a mesma matriz e falha se o job Docker não for executado sem
  waiver humano válido.
- Busca por valores conhecidos de `.env.local` nos envelopes JSON, stdout,
  stderr, logs e artefatos produzidos não encontra ocorrências.

Uma Sprint 4 é aceita quando todos os comandos acima passam em um projeto novo
dos dois perfis, com recursos efêmeros removidos e sem qualquer alteração no
ambiente local do usuário.
