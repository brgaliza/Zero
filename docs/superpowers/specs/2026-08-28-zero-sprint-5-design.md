# Zero — Design da Sprint 5: entrega para beta tester

**Status:** proposto em 28 de agosto de 2026  
**Dependência:** Sprint 4 aprovada

## Objetivo

Permitir que um beta tester em macOS Apple Silicon instale uma versão testada do
Zero e crie seu primeiro projeto sem precisar entender Node, npm, Docker ou a
estrutura do repositório. A pessoa deve conseguir seguir um roteiro linear,
copiando comandos quando necessário e recebendo ações claras quando faltar um
pré-requisito.

## Escopo

### Incluído

- Release GitHub versionada com tarball npm, checksum SHA-256 e notas de versão.
- Guia de instalação e primeiro uso em português do Brasil, dirigido a pessoa
  não técnica.
- Diagnóstico de pré-requisitos em `zero setup`, com mensagem orientada a ação.
- Roteiro de criação e validação de um projeto `essential`.
- Guia de recuperação e modelo de relato de suporte sem segredos.
- Teste de instalação limpa a partir do tarball publicado, sem checkout do Zero.

### Fora do escopo

- Instalação automática ou silenciosa de Node, npm, Docker Desktop, Homebrew ou
  ferramentas do sistema.
- Publicação em registry npm, auto-update, telemetria ou coleta de dados.
- Suporte oficial a Linux, Windows ou arquiteturas fora de Apple Silicon.
- Novo framework, perfil, serviço local ou deploy em nuvem.

## Contrato de distribuição

Cada beta sai como GitHub Release `v<semver>` com:

- `zero-v<semver>.tgz`, gerado por `npm pack` após as verificações exigidas;
- arquivo `SHA256SUMS` com o hash do tarball;
- notas de release com escopo, pré-requisitos, limitações conhecidas e instrução
  de rollback;
- tag Git apontando para o commit exato validado.

O guia instrui download do asset, verificação opcional do hash e instalação por
`npm install -g ./zero-v<semver>.tgz`. Ele não depende de login no npm. Se a
release estiver em repositório privado, o beta tester recebe acesso de leitura
ao repositório ou o arquivo é compartilhado por canal autorizado.

## Experiência do guia

O guia tem uma única trilha numerada, com frases curtas e um resultado esperado
após cada ação:

1. localizar e abrir o Terminal no Mac;
2. instalar Node.js LTS e npm pelos links oficiais, quando o `zero setup`
   indicar ausência ou versão incompatível;
3. instalar, abrir e aguardar Docker Desktop ficar pronto;
4. baixar e instalar o tarball, confirmar com `zero --version`;
5. executar `zero setup` e resolver exclusivamente o item que ele indicar;
6. criar projeto `essential` pelo fluxo guiado;
7. confirmar página local, `zero status` e `/api/health`;
8. encerrar com `zero down` quando desejar.

Todo comando aparece em bloco isolado para copiar e colar. Explicações técnicas
ficam escondidas em “Por que isso é necessário?”, sem interromper o caminho
principal. Capturas de tela entram somente para tarefas visuais que texto não
resolve bem: abrir o Terminal, iniciar Docker Desktop e reconhecer seu estado
pronto.

## Diagnóstico e suporte

`zero setup` mantém comportamento somente leitura e não instala programas. Para
cada pré-requisito, informa em linguagem simples: o que falta, por que o Zero
precisa disso, link oficial e a próxima ação. Resultados bem-sucedidos deixam
claro que nenhum passo adicional é necessário.

O guia de suporte usa uma árvore curta: comando não encontrado, Node/npm
incompatível, Docker não iniciado, falha de permissão de instalação global e
falha ao iniciar o projeto. Cada ramo contém somente comando seguro e resultado
esperado. O template de relato inclui versão do Zero, macOS, resultado de `zero
setup`, comando executado e mensagem sanitizada; proíbe anexar `.env.local`,
senhas, URLs autenticadas e logs integrais.

## Validação e aceite

- A release só é criada após `npm run check`, gauntlet Docker dos dois perfis e
  teste de instalação limpa do tarball.
- Um Mac sem checkout do repositório instala o tarball, executa `zero --version`
  e `zero setup`, e cria/valida projeto `essential` seguindo literalmente o
  guia em até dez minutos, em máquina com Docker e Node já instalados.
- O guia aponta links oficiais e comandos copiados sem placeholders, secrets ou
  dependência de conhecimento técnico implícito.
- O tarball, release, checksums, documentação e saída de suporte não incluem
  segredos, `.env.local`, estado local, logs brutos ou artefatos não permitidos.

Uma Sprint 5 é aceita quando uma pessoa beta consegue instalar e usar a versão
de release sozinha, ou relatar bloqueio de forma segura e acionável.
