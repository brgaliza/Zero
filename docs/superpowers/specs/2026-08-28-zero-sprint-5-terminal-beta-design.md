# Zero — Design revisado da Sprint 5: beta técnico por Terminal

**Status:** proposto em 28 de agosto de 2026  
**Substitui para esta sprint:** distribuição por DMG, assinatura Developer ID e
notarização previstas no design anterior.  
**Dependência:** Sprint 4 aprovada

## Objetivo

Permitir que um beta tester em Mac Apple Silicon com macOS 14 ou superior, mesmo
sem Node ou Docker, instale o Zero pelo Terminal, valide o arquivo recebido e
crie seu primeiro projeto `essential` sem acessar o repositório.

## Decisão de distribuição

Cada release privada `vX.Y.Z` entrega cinco assets:
`zero-vX.Y.Z.tgz`, `zero-bootstrap-vX.Y.Z.cjs`, `SHA256SUMS` e
`GUIA-BETA-pt-BR.md`, além de `release-manifest.json` canônico que fixa nome,
versão e hashes de tarball, bootstrap, guia e `SHA256SUMS`. O bootstrap é o único arquivo executável que o tester roda
antes de a CLI existir; ele é baixado junto ao tarball, mas não é extraído dele.
O tester recebe o link privado da release e o SHA-256 do manifesto em mensagem
individual por canal independente previamente combinado com a equipe. Antes de
ler o guia, a mensagem inicial manda baixar manifesto e guia, conferir ambos com
`shasum` e só então seguir o guia cujo hash coincide com o manifesto autenticado.
O guia verificado orienta a conferir cada asset contra manifesto e `SHA256SUMS`.
Divergência interrompe a instalação. O hash confere integridade e a mensagem externa autentica a referência esperada; a página de
release nunca é a única fonte de confiança. Não há DMG, app macOS, Gatekeeper, certificado Apple,
notarização, instalação por `sudo`, registry npm ou auto-update nesta sprint.

O pacote e o bootstrap são produzidos deterministicamente no mesmo commit.
Antes de qualquer tag, um workflow manual de candidate recebe SHA e versão,
executa `npm run check`, gera os dois assets, valida versão/inventário/digest e
emite um atestado contendo SHA, versão, hashes de todos os assets e ID de run. O candidate entra em
Environment com dois revisores e entrega seus assets privados para os Gates A e
B. Depois dos Gates, um workflow `promote-candidate`, protegido por dois
revisores, é o único emissor de tags: ele valida o atestado e as evidências,
cria a tag anotada por GitHub App restrito e registra `Zero-Candidate-Run` na
mensagem, com URLs das evidências A e B verificadas pelos revisores. Push direto de tags é proibido por ruleset. O workflow de publicação lê esse ID, consulta o atestado do run,
exige conclusão aprovada e exige correspondência exata entre SHA do candidate,
commit da tag, versão e hashes recriados. Qualquer divergência bloqueia a release.

## Fluxo literal do beta tester

O guia é escrito em pt-BR, sem pressupor conhecimento técnico, e separa cada
etapa em: o que abrir, o bloco para copiar e colar, o resultado esperado e o
que fazer se falhar.

1. O tester abre **Terminal** por Command + Espaço, digita `Terminal` e pressiona
   Enter. Confirma Mac Apple Silicon, macOS 14+, internet e 10 GB livres.
2. Copia `node --version`, `npm --version` e `docker version`. Se Node/npm não
   estiverem em Node 24 ou 26 e npm 11, o guia abre o link oficial do instalador
   macOS Apple Silicon do Node 26, instrui a avançar pelas telas padrão, fechar e
   reabrir o Terminal e executar novamente o bloco. Se Docker não mostrar Client
   e Server, o guia abre o link oficial do Docker Desktop para Apple Silicon,
   instrui abrir o app e aguardar **Engine running** antes de repetir o bloco.
3. O tester baixa `zero-vX.Y.Z.tgz` da release privada no navegador. No Terminal,
   primeiro confirma manifesto e guia pelo hash da mensagem externa. Depois executa
   um bloco que cria uma pasta privada em Downloads, move os dois arquivos de
   instalação para ela, calcula `shasum -a 256` e interrompe se algum valor não for
   exatamente o checksum do manifesto e de `SHA256SUMS`.
4. Depois da conferência, o tester executa o bootstrap separado com `node`. Ele
   recebe o caminho do tarball e os hashes esperados de tarball e bootstrap, recusa argumentos extras
   e usa npm local em modo offline, sem scripts, audit, fund ou configurações do
   usuário, somente para materializar o pacote já conferido. Ele extrai somente o inventário permitido para staging `0700`,
   valida versão e arquivos, instala sob `~/.zero/cli/versions/vX.Y.Z`, troca
   `~/.zero/cli/current` atomicamente e cria `~/.zero/bin/zero`. Não executa
   lifecycle scripts nem usa instalação global do npm. O instalador oferece
   incluir `~/.zero/bin` no PATH do zsh; se recusado, o guia usa o caminho
   absoluto em todos os comandos restantes.
5. O guia instrui executar `zero setup` (ou `~/.zero/bin/zero setup`), resolver
   somente o requisito indicado, criar o projeto com `zero new`, entrar na pasta
   sugerida e executar `zero up`. Ao final, mostra `zero down`, `zero report` e
   `zero rollback --previous` para encerramento, suporte e retorno local.

## Segurança e falhas

O download nunca é executado antes da conferência do checksum. Antes da primeira
mutação dos ponteiros, o instalador grava journal privado contendo os ponteiros
anterior e seguinte e o estágio da ativação. Na abertura seguinte ele recupera o
estado interrompido para os valores anteriores ou bloqueia com código estável se
não puder fazê-lo. O instalador usa
staging privado, rejeita paths fora do pacote, preserva a versão atual se
download, validação ou swap falhar e registra a versão anterior para rollback.
`zero report` continua limitado a dados sanitizados, com arquivo `0600`.

Se algum dos três checksums divergir, o guia manda apagar somente o arquivo
recebido e pedir novo link ao suporte. Se o Node, npm ou Docker continuarem incompatíveis, o
tester para e anexa apenas o relatório gerado por `zero report`; nunca envia
prints de terminal com dados pessoais, senhas ou tokens.

## Aceite

- Um tester sem checkout, Node ou Docker instala os pré-requisitos pelos links e
  passos do guia, baixa e confere o tarball e instala o Zero sem `sudo`.
- `zero setup`, `zero new`, `zero up`, `zero down`, `zero report` e rollback
  funcionam pela trilha de PATH aceita e pela trilha de caminho absoluto.
- Checksum, tag, asset, inventário e versão divergentes bloqueiam a instalação.
- A release privada contém tarball, checksum e guia coerentes; o gate de Mac
  limpo registra evidências do fluxo literal.

## Fora de escopo

DMG, assinatura/notarização Apple, Mac App Store, registry npm, auto-update,
Linux, Windows, telemetria, cloud e novos perfis.
