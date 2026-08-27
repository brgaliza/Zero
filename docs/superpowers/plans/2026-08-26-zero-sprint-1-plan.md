# Zero — Plano de implementação da Sprint 1

**Status:** concluída; gauntlet aprovado em 27 de agosto de 2026
**Data:** 26 de agosto de 2026
**Base de produto:** [design refinado da Fase 1](../specs/2026-08-26-zero-fase-1-design.md)

## 1. Objetivo do incremento

Entregar uma fundação segura, empacotável e determinística para o Zero Web.

Ao fim da Sprint 1, uma pessoa pode usar **zero setup** para entender o estado da máquina e **zero new** para criar, por assistente ou arquivo declarativo, a **fundação do perfil essential** de Next.js. O scaffold contém os contratos que a Sprint 2 usará para iniciar Docker, banco e aplicação.

Este incremento **não** entrega o ambiente funcional completo da Fase 1. A conclusão obrigatória é:

> Fundação criada. A validação em execução (Docker, PostgreSQL, migrations e aplicação) será entregue por zero up na Sprint 2.

A Sprint 1 não deve ser publicada ou apresentada como o fluxo final de criação do Zero.

## 2. Escopo fechado

### Incluído

- Monorepo npm/TypeScript e pacote CLI instalável por tarball.
- Comandos zero --version, zero --help, zero setup e zero new.
- Assistente PT-BR, resumo e confirmação antes de escrever.
- Criação não interativa: zero new --config <arquivo> --yes.
- Schemas e validação estrita de arquivo de criação e zero.yaml.
- Normalização de nome, descrição, slug e diretório.
- Materialização atômica e segura da fundação de next-fullstack/essential.
- Geração de zero.yaml, lock de template, .env.example, .gitignore, README, AGENTS.md, CLAUDE.md e código estático do template.
- Testes unitários, de CLI/scaffold e de instalação de npm pack.

### Fora da Sprint 1

- Docker/Compose, PostgreSQL em execução, migrations, seed, portas e processos.
- zero up, down, status, logs, doctor, test, build e clean.
- .env.local, secrets, journal e zero new --resume.
- Perfil complete, Redis, MinIO, Mailpit, painel e CRUD.
- Git, commit, GitHub, CI gerada e rede externa.
- Execução de npm dentro de projeto do usuário pela CLI.
- Alterações em projetos já criados.

A exclusão de execução, Git e secrets reduz a superfície de segurança enquanto os contratos de criação são estabilizados.

## 3. Jornada desta sprint

### zero setup

É somente diagnóstico. Classifica:

- **necessário agora:** Node.js LTS 24 e npm compatível;
- **necessário para executar posteriormente:** Docker Desktop;
- **necessário apenas em sprint futura de Git:** Git;
- **opcional para remoto futuro:** GitHub CLI.

Não instala nada nem abre navegador. Os probes usam argv fixo, sem shell ou rede; para Docker, detectam apenas a instalação local e nunca honram DOCKER_HOST, contextos remotos ou configuração fornecida pelo usuário. Cada estado tem motivo, ação e URL de uma allowlist oficial constante no código. Uma falha de probe é “indeterminado”, não “instalado”.

Na Sprint 1, Node/npm incompatível bloqueia zero new. Docker, Git e GitHub CLI são avisos não bloqueantes: a ausência deles não impede o scaffold estático.

### zero new interativo

1. Faz preflight antes de prompt ou escrita.
2. Solicita nome visível, descrição, endereço técnico e pasta em linguagem simples.
3. Sugere ~/Projetos/<slug> e valida inline.
4. Exibe caminho absoluto e impacto: “cria arquivos”.
5. Só materializa após confirmação inequívoca.
6. Informa honestamente que o projeto ainda não foi executado.

Ctrl+C antes da confirmação não muda estado. Diretórios existentes, inclusive vazios ou symlinks, são recusados.

### zero new não interativo

Contrato único:

```yaml
schemaVersion: 1
project:
  name: Minha Agenda
  description: Uma agenda pessoal
  slug: minha-agenda
  directory: ~/Projetos/minha-agenda
profile: essential
initialization:
  start: false
  git: false
  github:
    createPrivateRepository: false
```

Este é o subconjunto transitório e compatível de NewProjectConfig v1: todos os campos acima são obrigatórios. Qualquer valor true em initialization é rejeitado como indisponível nesta sprint; a Sprint 1 nunca interpreta ausência como autorização para mutar. O perfil complete é rejeitado como indisponível. Caminho relativo é resolvido contra o arquivo de configuração; somente o prefixo ~/ é expandido. Não há expansão de variáveis, glob ou shell.

zero new --config sem --yes e zero new --yes sem --config são erros de uso antes de I/O. zero new sem configuração requer TTY; stdin fechado ou EOF cancela com segurança antes de criar destino.

No modo --config ... --yes, stdout contém exatamente um envelope JSON versionado, inclusive em falhas; stderr contém apenas diagnóstico humano opcional. O envelope é { schemaVersion, ok, exitCode, code, message, nextAction, result? }, não contém secrets e usa subcódigos estáveis, como PREFLIGHT_NODE_UNSUPPORTED ou FILESYSTEM_WRITE_FAILED. Não há spinner, ANSI nem linhas extras em stdout. Códigos de saída:

| Código | Significado                              |
| ------ | ---------------------------------------- |
| 0      | scaffold criado                          |
| 2      | entrada, schema ou validação inválida    |
| 3      | pré-requisito ausente                    |
| 4      | falha externa ou de filesystem           |
| 5      | conflito de destino ou condição insegura |

O modo interativo é exclusivamente humano; sua saída não é contrato de automação.

## 4. Arquitetura

```text
packages/
  cli/        comandos, prompts, renderização e códigos de saída
  manifest/   schemas, parsing seguro e modelos puros
  scaffold/   inventário de template e materialização segura
templates/
  next-fullstack/
    essential/
tests/
```

packages/cli é o único pacote publicável. Seu build produz um executável ESM único em dist, incluindo manifest, scaffold e todas as dependências JavaScript de runtime permitidas. O pacote publicado não declara dependencies nem scripts de lifecycle; sua publicação é configurada com acesso restricted e a lista files inclui explicitamente dist, bin, templates e schemas. Assim, instalação global não resolve árvore transitiva em tempo de instalação. package-lock permanece versionado para reproduzir apenas o ambiente de build. Direção: cli depende de manifest e scaffold. Manifest não conhece terminal, filesystem, processos ou Docker. Scaffold recebe somente modelos já validados. Um pacote runtime/core só nasce na Sprint 2, quando houver responsabilidade concreta de Docker e processos.

Modelos:

- **NewProjectConfig:** intenção transitória; inclui diretório e nunca secrets.
- **ProjectManifest:** contrato portátil em zero.yaml; nunca inclui diretório local.
- **TemplateLock:** id, versão, schema e versão de CLI que materializou o template.
- **CommandResult:** resultado normalizado, sem dados sensíveis.

O ProjectManifest v1 usa runtime.nodeMajor 24, PostgreSQL 17, Prisma, profile essential, serviços opcionais false e capabilities.auth none. runtime.node não é alias válido. Na criação e validação do manifesto recém-gerado, o schema é estrito; na leitura de manifesto existente, campos futuros geram aviso estruturado em vez de falha. Nesta sprint não há perfil custom: essential exige os três serviços opcionais como false.

## 5. Controles obrigatórios

### Configuração e renderização

- Parser YAML sem documentos múltiplos, tags customizadas, aliases, merge keys ou chaves duplicadas.
- Rejeitar chaves desconhecidas, `__proto__` e equivalentes, inputs grandes/profundos e tipos inesperados.
- Normalizar Unicode, limitar tamanho e rejeitar controles, ESC/ANSI e bidi em inputs.
- Slug ASCII minúsculo, limitado e sem palavras reservadas.
- Renderizar YAML, JSON, Markdown e TSX com serialização específica; nunca interpolação textual genérica.

### Filesystem e template

- Tratar config, destino e template copiado como não confiáveis.
- Canonicalizar pai existente, criar destino exclusivamente e recusar destinos/symlinks existentes. Uma reserva exclusiva por destino protege execuções concorrentes do Zero e é removida ao final; uma reserva remanescente é relatada para inspeção manual.
- Materializar em staging temporário irmão, com nome aleatório criptograficamente forte e permissões privadas, sob o mesmo pai validado; renomear só depois de concluir. O Node 24 no macOS não expõe um rename de diretório com `no-replace`; portanto a reserva e as revalidações protegem concorrência entre execuções do Zero, mas não prometem proteção contra outro ator que altere o diretório pai durante a publicação.
- Provar para cada arquivo que o destino está sob o root canônico; não copiar symlinks, arquivos especiais ou paths absolutos.
- Usar inventário estático de template; nenhum caminho vem de input.
- Em falha ou SIGINT/SIGTERM, não publicar destino final parcial. Remover staging quando seguro; se não for possível, informar identificador não sensível e instrução de inspeção manual. Não sugerir retomada: zero new --resume ainda não existe.
- Criação exclusiva entre execuções do Zero, staging irmão e revalidações antes/depois da materialização são defesas para alterações acidentais e condições detectáveis. Elas não constituem sandbox nem uma primitiva atômica de `no-replace` contra outro ator que controla ou altera o diretório pai.

### Supply chain e subprocessos

- A CLI não executa npm, Git, Docker, shell ou processos do projeto nesta sprint, exceto probes fixos e somente de leitura para zero setup/preflight.
- CLI tem dependências mínimas de build, package-lock e nenhum lifecycle script. O artefato publicado é autocontido: não declara dependências de runtime nem inclui scripts de lifecycle próprios ou transitivos instaláveis.
- Teste de release gera npm pack, valida allowlist e o package.json empacotado, confirma ausência de dependencies e lifecycle scripts e instala tarball em diretório limpo com scripts desabilitados. A CI executa npm ci --ignore-scripts no checkout e pode executá-lo sobre fixture controlada; a CLI nunca executa npm no diretório de projeto do usuário.
- Publicação ainda não é implementada; a sprint apenas prepara controles de artefato.

### Fronteira de ameaça

O Zero evita acidentes e configurações equivocadas/maliciosas dentro da conta local. Não promete isolar quem já controla o usuário, PATH, diretório pai, Docker socket ou a máquina.

## 6. Plano em ordem de commit

### 1. Base distribuível

Criar workspace, TypeScript, lint, formatter, testes e os três pacotes. Configurar bin zero, versão, ajuda mínima e empacotamento.

**Aceite:** npm pack contém somente bin e dist esperados; seu package.json não tem dependencies ou lifecycle scripts; instalado em pasta temporária com scripts desabilitados, executa zero --version e zero --help. npm publish --dry-run mantém o bin e resolve acesso restricted, sem publicar. Templates e schemas entram no gate de empacotamento no commit 4.

### 2. Modelos, schemas e parser

Implementar modelos, parser YAML restrito, validação semântica, normalização e erros por campo.

**Aceite:** corpus de YAML malicioso/inválido, campos desconhecidos, chaves duplicadas, aliases, valores grandes, `__proto__`, slug/nome malicioso e manifesto incompatível falha antes de I/O.

### 3. Caminhos e scaffold atômico

Implementar caminhos, expansão limitada de ~/, inspeção de destino, staging, inventário de template e serialização contextual.

**Aceite:** traversal, symlinks, destino existente, case collision detectável, unicode, espaços e arquivo especial não escrevem fora do root validado nem deixam destino final parcial. Testes de corrida confirmam criação exclusiva, staging irmão e falha segura nas condições detectáveis. Input válido gera árvore e manifesto determinísticos, sem timestamps, caminhos absolutos ou IDs aleatórios no resultado final.

### 4. Template essential estático

Adicionar Next/Prisma estático, package-lock, zero.yaml, lock, .env.example, .gitignore e documentos de orientação. Não gerar secret nem executar app.

**Aceite:** validação estrutural confirma contratos, serviços desabilitados, Postgres 17, Node 24, Prisma, auth none e ausência de valores sensíveis. O template no tarball equivale ao do checkout, é materializado por uma geração real a partir do tarball e passa npm ci --ignore-scripts em fixture temporária controlada. README, AGENTS.md e CLAUDE.md dizem que o scaffold está pré-execução e não instruem comandos inexistentes.

### 5. Setup, ajuda e erros

Implementar zero setup, preflight de new, renderizador único PT-BR, 80 colunas e NO_COLOR=1.

**Aceite:** setup diferencia bloqueador atual, necessidade futura e item opcional; zero --help, zero new --help e zero help new são coerentes e imutáveis.

### 6. zero new nos dois modos

Implementar prompts, resumo, confirmação, cancelamento, scaffold, JSON e códigos de saída.

**Aceite:** interativo e config válido geram o mesmo projeto; Ctrl+C, EOF, SIGINT durante staging, schema inválido, requisito ausente e conflito não criam destino final; --yes produz envelope JSON puro e código correto para sucesso, validação, preflight, conflito e falha de filesystem.

### 7. Gauntlet e documentação

Executar regressão adversarial, teste de tarball e revisão independente de segurança, usabilidade, arquitetura e testabilidade. Corrigir achados bloqueadores.

**Aceite:** matriz da seção 7 passa em checkout limpo; documentação diz visivelmente que ambiente em execução é entrega da Sprint 2.

## 7. Matriz mínima de testes

| Área     | Casos obrigatórios                                                                                                     |
| -------- | ---------------------------------------------------------------------------------------------------------------------- |
| Parser   | YAML malformado, múltiplos documentos, chaves duplicadas/desconhecidas, aliases, proto pollution, tamanho/profundidade |
| Entrada  | descrição ausente, slug inválido, controles/ANSI/bidi, unicode e limites                                               |
| Caminho  | home, relativo, espaço, unicode, existente, vazio, symlink, traversal, case collision e troca concorrente              |
| Scaffold | determinismo, staging/rename, arquivo fora do root, template alterado e falha de cópia                                 |
| CLI      | confirmação, cancelamento, 80 colunas, sem cor, preflight, PT-BR, códigos e JSON                                       |
| Pacote   | allowlist, npm pack, instalação limpa sem scripts, bin e templates                                                     |
| Contrato | manifesto v1, lock, .gitignore, .env.example, docs e ausência de secrets                                               |

## 8. Gates de saída

A Sprint 1 só termina se:

1. nenhum finding crítico ou alto do gauntlet permanecer aberto;
2. input inválido não escrever no destino final;
3. o tarball, e não apenas checkout, gerar o scaffold;
4. o modo não interativo for seguro, determinístico e parseável;
5. CLI e docs não chamarem o resultado de ambiente pronto;
6. itens fora de escopo mostrarem indisponibilidade clara, não erro obscuro.

## 9. Pré-condições da Sprint 2

Antes de adicionar runtime/Docker, especificar e revisar: contexto Docker local permitido, Compose controlado, secrets com criação exclusiva, journal seguro, migrations, isolamento de portas/volumes e comportamento de processos.
