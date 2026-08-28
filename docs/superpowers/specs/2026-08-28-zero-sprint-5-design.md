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
instalação limpa. Então gera uma única saída de
`npm pack --workspace=@brunogaliza/zero --ignore-scripts`, renomeia para
`zero-vX.Y.Z.tgz`, cria `SHA256SUMS` e `SHA256SUMS.asc`, baixa o asset final e o
valida antes de publicar.

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
   falhar, seguir o ramo correspondente antes de instalar o Zero. Para Node/npm
   ausentes ou fora da faixa, o guia fornece link direto para o instalador oficial
   macOS Apple Silicon do Node `26.x` fixado no manifesto da release, instrui
   abrir o `.pkg`, avançar pelas telas padrão, fechar/abrir o Terminal e esperar
   `node --version` `26.` e `npm --version` `11.`. Se o instalador não entregar
   npm 11, a guia manda parar e reinstalar o pacote exato, nunca usar `npm -g`;
3. para Docker ausente, o guia fornece link direto ao Docker Desktop para Apple
   Silicon, instrui abrir o DMG, arrastar para Aplicativos, abrir Docker Desktop,
   aprovar as telas padrão e aguardar o indicador “Engine running”; só avança
   quando `docker version` mostrar Client e Server. Capturas obrigatórias cobrem
   essas telas, Terminal reaberto e os resultados esperados;
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
6. copiar o comando de criação renderizado na trilha escolhida (`zero new` ou
   `~/.zero/bin/zero new`) e responder exatamente nome, descrição, slug, pasta
   sugerida, perfil `essential`, início `não` e confirmação `sim`; copiar sem
   edição o próximo bloco já impresso pela CLI, que entra na pasta criada e
   executa o `up` da mesma trilha;
7. abrir a URL e executar a validação que o Zero imprimir;
8. encerrar com `zero down` quando desejar.

O gerador substitui a forma de comando escolhida em todas as ocorrências, inclusive
versão, setup, criação, validação, up/down, report e rollback; não mistura os
dois ramos. O template contém o bloco literal de `new`, suas respostas, e o bloco
literal de `cd` seguido de `up` produzido para aquela pasta. O Zero deve imprimir
esses blocos, a pasta, URL e próximo comando de validação de modo que o guia não
exija inferência de portas, `cd` ou rota de health. Capturas entram somente para
abrir Terminal e reconhecer Docker Desktop pronto.

## Diagnóstico, suporte e rollback

`zero setup` continua somente leitura, mas distingue Docker ausente, instalado
com Desktop parado, daemon inacessível, transporte remoto recusado e pronto.
Explica o que falta, por que importa, link oficial e próxima ação. As faixas
A Sprint 5 altera o contrato para Node `24.x` ou `26.x` e npm `11.x`; qualquer
outro major bloqueia criação/operação. A implementação atualiza ambos
`package.json`, a validação de runtime de `zero setup` e a do instalador, e alinha
`engines.node` a `^24 || ^26` e `engines.npm` a `>=11 <12`. Nova faixa só entra
após gates de compatibilidade nesses três pontos. Testes cobrem Node 24, Node 26,
npm 11 e versões antigas/incompatíveis. Em particular, Node 23, Node 27+, npm 10
e npm 12+ devem falhar, antes de instalar, criar ou operar, no preflight,
instalador e CLI.

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
`~/.zero/cli/versions/vX.Y.Z`. Como o gate de pacote exige zero dependencies e
scripts, o instalador não entrega um caminho do Downloads ao npm: baixa o tarball
diretamente em staging aleatório `0700`, cria arquivo exclusivo `0600` com
`O_NOFOLLOW`, e mantém o descritor aberto. Calcula e verifica assinatura,
provenance e digest sobre esses mesmos bytes; um extrator interno com paths,
inventário e modos allowlisted consome esse descritor e materializa o pacote em
`<staging>/package`. O arquivo é apagado em falha e nunca se executa arquivo cuja
verificação não tenha ocorrido no descritor consumido. O extrator aceita somente
diretórios e arquivos regulares da lista de pacote, rejeita symlink, hardlink,
device, FIFO, path absoluto e qualquer componente `..`; limita a 1.000 entradas,
10 MiB por arquivo, 100 MiB descompactados no total e profundidade 12. Rejeita
paths duplicados, não ASCII ou cuja normalização Unicode mude, e todo header
PAX/GNU extra; descarta ownership e cria cada destino com resolução sem-follow
confinada ao staging. Testes cobrem cada rejeição, colisão e estouro de limite.
Antes de criar o wrapper, ele valida `package.json` contra a allowlist embutida:
nome, versão igual à tag, `bin.zero`, `files`, `private: false`, `publishConfig`
esperado, engines aprovados, ausência de dependencies, optionalDependencies e
lifecycle scripts. O manifesto traz inventário exato de `dist`, `templates` e
`schemas`, com paths/modos/digests; campo ou arquivo inesperado falha fechado.
Antes do swap, cria
`<staging>/bin/zero`, wrapper executável que chama o Node aprovado pelo instalador
e `<staging>/package/dist/main.js`; testa o wrapper com `--version` e `--help`.
Só então move o staging para `versions/vX.Y.Z`, cria/troca atomicamente
`~/.zero/cli/current` para essa versão e cria o shim estável
`~/.zero/bin/zero`. O shim é imutável e executa exclusivamente
`~/.zero/cli/current/bin/zero`. Em macOS com zsh, com consentimento, inclui uma
única linha marcada e idempotente em
`~/.zprofile`; mostra o arquivo alterado, pede fechar o Terminal aberto antes da
instalação, abrir um novo e só seleciona a trilha `zero` depois de `command -v
zero` apontar para `~/.zero/bin/zero`. Se o shell não for zsh, a edição falhar ou
o comando não resolver, não altera outro arquivo e seleciona a trilha integral
`~/.zero/bin/zero`. Finder não precisa herdar PATH de nvm/asdf: procura,
nesta ordem, pares `node`/`npm` em `/opt/homebrew/bin`, `/usr/local/bin`,
`~/.nvm/versions/node/*/bin` e `~/.asdf/installs/nodejs/*/bin`; dentro de uma
raiz escolhe a maior versão compatível, e entre raízes vence a primeira. Para
instalação encontrada mas incompatível ou gerenciador fora da lista, para com a
categoria segura “runtime incompatível” e link oficial de instalação, sem exibir
ou persistir caminho pessoal; testes cobrem múltiplas versões e processo gráfico
sem PATH.

Instalação, atualização e rollback adquirem antes do staging um lock exclusivo
`fcntl(F_SETLK)` em `~/.zero/cli/.operation.lock` (`0600`), mantido até limpeza e
swap. Uma segunda execução não toca staging nem `current`: mostra “operação em
curso” e sai. O conteúdo do lock registra PID e start-time somente para diagnóstico;
o lock do kernel é automaticamente liberado em crash, e a execução seguinte remove
somente staging sem dono antes de continuar. Testes executam os três fluxos em
concorrência e simulam crash/lock órfão.

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
staging, swap, shim e interrupção do processo, e substituem o tarball após cada
verificação para provar que bytes alterados nunca são executados. Testes de
instalação inicial, atualização e rollback confirmam que `zero --version` muda
somente após o swap e preserva a versão anterior em falha. Rollback não toca
containers, volumes ou arquivos de projetos.

## Controles verificáveis de publicação

O workflow cria primeiro release em rascunho, gera/upload os assets, baixa-os da
API de release, verifica assinatura da tag contra fingerprint allowlisted e
verifica assinatura/checksum do tarball. Só então publica. Branch protection e
Environment GitHub `beta-release` exigem aprovação do responsável nomeado; o
workflow falha quando o autor/assinante/tag não pertence à allowlist.

Além de `SHA256SUMS.asc`, o job emite e anexa `provenance.sigstore.json`, Sigstore
Bundle JSON canônico que contém exatamente um envelope DSSE, cadeia de certificado
Fulcio e bundle/prova de inclusão Rekor. O envelope contém um único in-toto
Statement com `predicateType` `https://zero.dev/attestation/beta/v1` e
`predicate.schemaVersion` `1`: `subject[0]` tem nome do tarball e digest SHA-256;
`predicate.source` tem `repository`, `commitSha` e `releaseTag`; e
`predicate.builder` tem `issuer`, `workflowRef` e `workflowSha`. Gate e
instalador usam a biblioteca Sigstore na versão pinada pelo manifesto para validar
offline assinatura e prova, e exigem uma única ocorrência de cada campo. As
camadas JSON rejeitam chaves duplicadas antes da desserialização, JSON não-JCS
(RFC 8785), valores fora de string ASCII onde exigido, números e tipos alternativos;
limitam bundle a 1 MiB e profundidade 16. Fixtures cobrem duplicidade de todos os
claims, subject, digest e policy. As
extensions/SAN do certificado Fulcio fornecem `issuer`, `repository`, `ref/tag`,
`workflowRef` e `workflowSha`; cada valor deve ser byte a byte igual ao
Statement e à política embutida. `subject.digest`, source URI/digest, tag, commit e
identidade de builder também devem coincidir exatamente; ausência, multiplicidade
ou divergência falha fechado. O certificado Fulcio pode estar expirado no momento
da instalação somente se a prova Rekor demonstrar que estava válido no instante
assinado; cadeia inválida, revogação aplicável ou prova ausente/inválida falha
fechado. O DMG contém manifesto
de política canônico, assinado pela chave de release embutida e protegido pela
assinatura do app, com valores literais e únicos `repository`, `release_tag`,
`commit_sha`, digest, `workflow_ref` e `workflow_sha`. O primeiro é comparado byte
a byte como `owner/repo/.github/workflows/beta-release.yml@refs/tags/vX.Y.Z`; o
segundo é SHA-40 do arquivo de workflow executado. Não aceita normalização,
curingas, branch diferente, tag diferente, campo ausente, duplicado ou ambíguo.
O verificador extrai o SHA somente do claim
assinado e o compara ao manifesto, nunca deriva um do outro. A política não deriva
da proveniência e só muda em novo instalador assinado pela identidade já confiável.
Testes adulteram assinatura, certificado/identidade, inclusão, cada claim, cada
campo de política e somente o SHA do workflow, todos com falha fechada.
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
produz, assina, verifica e anexa o DMG junto aos assets. Interface e logs locais
persistidos usam schema fechado: `code`, `stage`, `next_action_id` enumerado e
parâmetros públicos allowlisted (somente versão). A UI renderiza texto local a
partir de `next_action_id`; nunca interpola stderr, URL recebida, path, header HTTP,
argumento do usuário ou exceção. Testes limitam tamanho e injetam segredos na
apresentação e no crash-recovery, além de download, assinatura, extrator e
subprocesso.

A identidade Developer ID e a chave de release nunca são exportadas: serviço de
assinatura remoto/HSM recebe OIDC do GitHub Actions e valida diretamente os claims
do JWT contra política própria, imutável para o job e administrada fora do
repositório: issuer e audience literais, repository canônico, tag/ref protegida,
`workflow_ref`, `workflow_sha`, SHA do commit e Environment `beta-release`.
Manifesto, parâmetros e conteúdo enviados pelo job nunca autorizam assinatura.
Como OIDC não prova aprovações, o HSM consulta por GitHub App read-only separado a
API autenticada de deployment/reviews para o `run_id` e exige dois IDs de reviewer
com decisão aprovada, distintos entre si e do `actor_id`; resposta ausente,
ambígua ou sem correspondência falha fechado. A auditoria imutável retém IDs,
hash da resposta, repositório, tag, SHA e workflow por sete anos. Alterar a
allowlist requer controle administrativo separado e dois responsáveis. O
Environment nega pull request, fork e branch; workflow alterado não ganha
capacidade de assinatura apenas por estar em branch protegida. Cada assinatura
gera auditoria imutável com repositório, tag, SHA, workflow e operador.
A credencial de notarização fica em cofre separado, com escopo exclusivo de
notarização, rotação documentada e injetada somente nesse job sem leitura/impressão
em logs. O gate testa essa separação de permissões antes da primeira release e em
cada alteração do workflow de publicação.

Antes de publicar, um Human Gate executa a trilha literal em Mac Apple Silicon
sem Zero, checkout ou estado anterior, com macOS 14+, Node/npm compatíveis e
Docker Desktop instalados pelo roteiro oficial. Registra as versões de macOS,
Node, npm e Docker, tempos, screenshots dos passos visuais e saída sanitizada.
Exercita os dois ramos do guia: consentir e recusar PATH, incluindo rollback em
ambos, e o fallback de PATH não resolvido. Falha de qualquer passo bloqueia a
release; CI Linux continua complementar, não substituta.

Um segundo Human Gate obrigatório inicia em snapshot recém-provisionado de macOS
Apple Silicon físico ou VM, sem Zero, Node, npm, Docker Desktop, Homebrew, Volta,
fnm, nvm, asdf, Colima, caches ou PATH herdado. Antes do roteiro, registra que
`command -v node npm docker` não encontra nada e que os diretórios desses
gerenciadores não existem. Segue literalmente os ramos “ausente” do guia, instala
os pré-requisitos pelas páginas e telas oficiais indicadas, fecha/abre o Terminal,
abre Docker Desktop até o daemon ficar pronto, instala o Zero e conclui o primeiro
projeto. Registra links/telas usados, versões detectadas, tempos e falhas; qualquer
inferência não coberta ou falha bloqueia a publicação.

## Aceite

- A release publicada contém DMG do instalador macOS, tarball, checksum, assinatura e
  provenance, com tag
  verificáveis, sem secrets ou estado local.
- Um Mac sem checkout instala o asset final, executa setup e cria/valida um
  projeto `essential` seguindo literalmente o guia. A auditoria registra tempos
  observados; não há SLA que dependa de rede ou primeiro pull.
- A instalação limpa e o Human Gate exercitam tanto a trilha com `zero` no PATH
  quanto a trilha integral com `~/.zero/bin/zero`.
- O Human Gate copia, sem edição manual, o bloco de criação e o bloco de entrada/
  `up` impressos pela CLI; npm 10 e npm 12+ falham antes de instalar, criar ou
  operar, Node 23 e 27+ falham, e Node 24/26 com npm 11 conclui a trilha.
- Um segundo Human Gate, sem Node/npm/Docker Desktop no usuário inicial, instala
  os pré-requisitos apenas pelo guia e conclui o primeiro projeto sem inferência.
- O fluxo principal precisa concluir para aceitar a sprint. Relato seguro é
  métrica de suporte, não substituto do sucesso.
- Teste de instalação limpa, pacote, gauntlet Docker e validação do asset final
  passam antes da release.
