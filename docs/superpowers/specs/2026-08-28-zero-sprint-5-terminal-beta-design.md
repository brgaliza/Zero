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

Cada release privada `vX.Y.Z` entrega três assets: `zero-vX.Y.Z.tgz`,
`SHA256SUMS` e `GUIA-BETA-pt-BR.md`. O tester recebe o link privado da release
e o SHA-256 exato em mensagem individual por canal independente previamente
combinado com a equipe. Ele compara os três valores: mensagem, `SHA256SUMS` e
resultado de `shasum`. Divergência interrompe a instalação. O hash confere
integridade e a mensagem externa autentica a referência esperada; a página de
release nunca é a única fonte de confiança. Não há DMG, app macOS, Gatekeeper, certificado Apple,
notarização, instalação por `sudo`, registry npm ou auto-update nesta sprint.

O pacote é produzido por `npm pack --ignore-scripts` no workspace
`@brunogaliza/zero`. Antes de qualquer tag, um workflow manual de candidate
executa `npm run check`, gera o tarball determinístico, valida a versão interna e
o inventário, e entrega um artefato privado para os Gates A e B. Só evidências
aprovadas dos dois Gates permitem criar a tag protegida. O workflow de publicação
da tag recria os assets do commit tagueado, confere tag, versão, nome e checksum
e cria uma GitHub Release privada; somente esse job recebe `contents: write`.

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
   executa um bloco que cria uma pasta privada em Downloads, move o arquivo para
   ela, calcula `shasum -a 256` e interrompe se o valor não for exatamente o
   checksum da mensagem externa e do guia.
4. Depois da conferência, o tester executa um instalador local entregue dentro do
   próprio tarball. Ele extrai somente o inventário permitido para staging `0700`,
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

O download nunca é executado antes da conferência do checksum. O instalador usa
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
