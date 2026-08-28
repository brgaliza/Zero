# Zero — Design da Sprint 5: entrega para beta tester

**Status:** revisado em 28 de agosto de 2026  
**Dependência:** Sprint 4 aprovada

## Objetivo

Permitir que um beta tester em macOS Apple Silicon instale uma versão validada do
Zero e crie seu primeiro projeto sem conhecer Node, npm, Docker ou o repositório.

## Escopo

Inclui release GitHub versionada, guia não técnico em pt-BR, diagnóstico de
pré-requisitos, `zero report` sanitizado, roteiro `essential`, rollback e teste
de instalação limpa. Não inclui instalação automática de ferramentas do sistema,
registry npm, auto-update, telemetria, Linux/Windows, novos perfis ou cloud.

## Release autenticável e reproduzível

Cada release `vX.Y.Z` nasce de tag Git anotada, assinada e protegida, apontando
para o commit validado. O workflow, acionado somente por essa tag, executa em
runner limpo: `npm run check`, gauntlet Docker dos dois perfis e teste de
instalação limpa. Então gera uma única saída de `npm pack --ignore-scripts`,
renomeia para `zero-vX.Y.Z.tgz`, cria `SHA256SUMS` e `SHA256SUMS.asc`, baixa o
asset final e o valida antes de publicar.

As notas registram SHA do commit, SHA-256, versão, ID do workflow, limitações,
canal de suporte e rollback. O workflow recusa versão divergente, asset existente
ou falha em qualquer gate. Só o job de upload recebe `contents: write`.

A chave pública canônica de release e seu fingerprint ficam embutidos no
instalador; cópia idêntica fica no repositório e chega ao tester por canal
independente do asset. O instalador nunca baixa chave de endpoint não autenticado.
Rotação exige um release assinado pela chave anterior e uma nova versão do
instalador contendo a nova chave; chave substituída, revogada ou sem cadeia de
rotação interrompe a instalação. Assinatura e hash são obrigatórios no gate; hash
publicado junto ao asset não é tratado como autenticação.

## Guia de beta

O workflow gera e anexa `GUIA-BETA-pt-BR.md` a cada release; não há placeholders.
O template obrigatório preenche URL exata de
`Zero-Beta-Installer-vX.Y.Z.dmg`, caminho literal em Downloads, instrução para
abrir o DMG e arrastar o app para Aplicativos, um bloco completo que executa
`codesign --verify --deep --strict --verbose=2`, `spctl -a -vv -t execute` e
`codesign -dv --verbose=4` sobre `"/Applications/Zero Beta Installer.app"`,
unidos por `&&` para parar no primeiro erro. O texto esperado exige os dois
verificadores aprovados e então mostra o único valor humano a comparar,
`TeamIdentifier`, com o Team ID que chega pela mensagem de boas-vindas em canal
independente. Fingerprint/chave do tarball não é verificação manual: a chave
pública canônica embutida é verificada somente pelo instalador. O template também
preenche URL oficial de cada pré-requisito, caminho de `zero report` e texto
esperado de sucesso/falha. O guia contém uma trilha única, em blocos de copiar e
colar e resultado esperado após cada ação:

```sh
codesign --verify --deep --strict --verbose=2 "/Applications/Zero Beta Installer.app" && spctl -a -vv -t execute "/Applications/Zero Beta Installer.app" && codesign -dv --verbose=4 "/Applications/Zero Beta Installer.app" 2>&1
```

Esse é o bloco obrigatório antes da primeira abertura: `codesign` termina sem
erro, `spctl` informa avaliação aceita e a última saída contém o `TeamIdentifier`
esperado. A aceitação de `spctl`/exit code `0`, não a presença de quarentena, é o
critério; qualquer outro resultado instrui parar e contatar suporte, sem remover
quarentena, usar `xattr` ou contornar Gatekeeper.

1. confirmar macOS 14+, Apple Silicon, 10 GB livres e rede estável;
2. abrir o Terminal e executar o preflight independente copiado do guia
   (`node --version`, `npm --version` e `docker version`); se algum comando
   falhar, seguir o link oficial e a instrução concreta correspondente antes de
   instalar o Zero;
3. instalar, abrir e aguardar Docker Desktop ficar pronto;
4. baixar o DMG para Downloads, abri-lo, arrastar `Zero Beta Installer.app` para
   Aplicativos e executar, antes da primeira abertura, o bloco completo copiado
   do guia; ele falha no primeiro erro de assinatura/Gatekeeper. Somente após os
   dois verificadores aprovados, localizar `TeamIdentifier` na saída e compará-lo
   com o Team ID da mensagem de boas-vindas recebida por canal independente;
   divergência interrompe o fluxo. O instalador verifica automaticamente
   assinatura, fingerprint, provenance e checksum antes de instalar o tarball
   com lifecycle scripts desabilitados, e para sem instalar se algo falhar;
5. aceitar ou recusar a inclusão no PATH; o instalador indica uma das duas
   trilhas completas do guia: todos os comandos usam `zero` se aceita ou
   `~/.zero/bin/zero` se recusada. Confirmar a versão e executar `setup` pela
   trilha indicada, resolvendo somente o item apontado;
6. criar projeto `essential` com respostas transcritas no guia (nome, descrição,
   slug, pasta sugerida, perfil `essential`, início `não` e confirmação `sim`),
   entrar na pasta impressa e executar `zero up`;
7. abrir a URL e executar a validação que o Zero imprimir;
8. encerrar com `zero down` quando desejar.

O gerador substitui a forma de comando escolhida em todas as ocorrências, inclusive
versão, setup, criação, validação, up/down, report e rollback; não mistura os
dois ramos. O Zero deve imprimir a pasta, URL e próximo comando de validação de
modo que o guia não exija inferência de portas, `cd` ou rota de health. Capturas
entram somente para abrir Terminal e reconhecer Docker Desktop pronto.

## Diagnóstico, suporte e rollback

`zero setup` continua somente leitura, mas distingue Docker ausente, instalado
com Desktop parado, daemon inacessível, transporte remoto recusado e pronto.
Explica o que falta, por que importa, link oficial e próxima ação. As faixas
aceitas seguem o contrato atual: Node `>=24` e npm `11.x`; qualquer outro major
de npm bloqueia criação/operação. Nova faixa só entra após gates de compatibilidade
no preflight, instalador e `zero setup`; a implementação também alinha
`engines.npm` a `>=11 <12`. Testes cobrem Node 24, Node 26, npm 11 e versões
antigas/incompatíveis.

`zero report` gera `~/.zero/reports/zero-report.json` com arquivo `0600` e
diretórios `~/.zero`/`reports` `0700`; substitui de forma atômica somente o
relatório anterior e nunca grava em outro local. Se não puder criar esse caminho,
informa código estável sem imprimir dados diagnósticos e instrui o suporte. Aceita
somente allowlist de campos: versão Zero, versão macOS, arquitetura,
versões Node/npm/Docker, estados enumerados de `zero setup`, código estável do
último comando e timestamp. Ele nunca inclui stdout/stderr, caminhos pessoais,
mensagens brutas de subprocesso, `.env.local`, URLs, tokens, senhas ou logs. O
schema é estrito, o tamanho é limitado e testes adversariais injetam segredos e
mensagens de erro em todas as fronteiras de serialização. O guia de
suporte cobre comando ausente, PATH, Docker, permissão global e falha de projeto;
instrui anexar somente esse arquivo e informar a etapa. Notas da release definem
canal, responsável e prazo de resposta.

O instalador não usa `npm -g`: instala em prefixo privado user-owned
`~/.zero/cli/versions/vX.Y.Z`, testa o binário e cria shim estável
`~/.zero/bin/zero`. Em macOS com zsh, com consentimento, inclui uma única linha
marcada e idempotente em `~/.zprofile`; mostra o arquivo alterado, pede fechar o
Terminal aberto antes da instalação, abrir um novo e só seleciona a trilha `zero`
depois de `command -v zero` apontar para `~/.zero/bin/zero`. Se o shell não for
zsh, a edição falhar ou o comando não resolver, não altera outro arquivo e
seleciona a trilha integral `~/.zero/bin/zero`. Finder não precisa herdar PATH de
nvm/asdf: procura,
nesta ordem, pares `node`/`npm` em `/opt/homebrew/bin`, `/usr/local/bin`,
`~/.nvm/versions/node/*/bin` e `~/.asdf/installs/nodejs/*/bin`; dentro de uma
raiz escolhe a maior versão compatível, e entre raízes vence a primeira. Para
instalação encontrada mas incompatível ou gerenciador fora da lista, para com o
caminho encontrado e link oficial de instalação; testes cobrem múltiplas versões
e processo gráfico sem PATH.

O guia inclui a tela do instalador “Reverter para a versão anterior” e o comando
equivalente na forma escolhida, `zero rollback --previous` ou
`~/.zero/bin/zero rollback --previous`. Ambos exibem versão-alvo, exigem
confirmação e obtêm o artefato da release anterior pelos mesmos controles de
assinatura, chave embutida e provenance. Rollback instala a versão anterior em
staging, testa-a e verifica matriz CLI↔schema/template; só então troca `current`
por rename atômico de symlink. Ao iniciar, qualquer instalação detecta `current`
ausente ou staging abandonado, preserva a última referência válida registrada e
mostra recuperação determinística. Metadata anterior é mantida até confirmar o
swap; falha restaura a referência anterior. Testes injetam falha em download,
staging, swap, shim e interrupção do processo. Rollback não toca containers,
volumes ou arquivos de projetos.

## Controles verificáveis de publicação

O workflow cria primeiro release em rascunho, gera/upload os assets, baixa-os da
API de release, verifica assinatura da tag contra fingerprint allowlisted e
verifica assinatura/checksum do tarball. Só então publica. Branch protection e
Environment GitHub `beta-release` exigem aprovação do responsável nomeado; o
workflow falha quando o autor/assinante/tag não pertence à allowlist.

Além de `SHA256SUMS.asc`, o job emite atestação de proveniência DSSE vinculada ao
digest do tarball, ao SHA do commit, à tag e ao ID do workflow, e a anexa como
quarto asset `provenance.intoto.jsonl`. O gate e o instalador validam a assinatura
DSSE com a raiz Sigstore confiável, certificado Fulcio e identidade OIDC; exigem
issuer GitHub Actions, subject do repositório canônico, workflow path permitido,
ref/tag exata, predicate type SLSA aprovado, digest idêntico e entrada de
transparência Rekor com prova de inclusão válida. Certificado Fulcio pode estar
expirado no momento da instalação somente se a prova Rekor demonstrar que estava
válido no instante assinado; cadeia inválida, revogação aplicável, identidade fora
da política ou prova ausente/inválida falha fechado. Testes adulteram assinatura,
certificado/identidade, inclusão e cada campo de política.
A instalação para se fingerprint, assinatura, provenance ou checksum falhar;
apresenta a causa e orienta contatar suporte, sem instalar o arquivo.

`Zero-Beta-Installer-vX.Y.Z.dmg` é o asset operacional da release e contém
`Zero Beta Installer.app`. A aplicação macOS universal é assinada e notarizada
pela identidade de distribuição do Zero;
Gatekeeper e o preflight manual verificam assinatura estrita, avaliação Gatekeeper
e Team ID/certificado allowlisted antes de abrir. A mensagem independente autentica
também o instalador. Ela contém o verificador de
release e orquestrador de instalação, usa fingerprint embutido e allowlist de
repositório/workflow, mostra progresso e nunca executa shell remoto. Um manifesto
embutido e assinado fixa versão, tag e digest do tarball aceito para aquele DMG;
qualquer divergência ou asset de outra release falha fechado. Exige Node/npm já
aprovados pelo preflight, instala somente tarball verificado com
lifecycle scripts desabilitados e grava relatório sanitizado em falha. O gate
produz, assina, verifica e anexa o DMG junto aos assets.

Antes de publicar, um Human Gate executa a trilha literal em Mac Apple Silicon
sem Zero, checkout ou estado anterior, com macOS 14+, Node/npm compatíveis e
Docker Desktop instalados pelo roteiro oficial. Registra as versões de macOS,
Node, npm e Docker, tempos, screenshots dos passos visuais e saída sanitizada.
Exercita os dois ramos do guia: consentir e recusar PATH, incluindo rollback em
ambos, e o fallback de PATH não resolvido. Falha de qualquer passo bloqueia a
release; CI Linux continua complementar, não substituta.

## Aceite

- A release publicada contém DMG do instalador macOS, tarball, checksum, assinatura e
  provenance, com tag
  verificáveis, sem secrets ou estado local.
- Um Mac sem checkout instala o asset final, executa setup e cria/valida um
  projeto `essential` seguindo literalmente o guia. A auditoria registra tempos
  observados; não há SLA que dependa de rede ou primeiro pull.
- A instalação limpa e o Human Gate exercitam tanto a trilha com `zero` no PATH
  quanto a trilha integral com `~/.zero/bin/zero`.
- O fluxo principal precisa concluir para aceitar a sprint. Relato seguro é
  métrica de suporte, não substituto do sucesso.
- Teste de instalação limpa, pacote, gauntlet Docker e validação do asset final
  passam antes da release.
