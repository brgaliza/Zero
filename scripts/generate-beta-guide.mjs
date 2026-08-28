import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const values = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  const key = process.argv[index];
  const value = process.argv[index + 1];
  if (key?.startsWith("--") && value !== undefined) values.set(key, value);
}
const version = values.get("--version");
const dmgUrl = values.get("--dmg-url");
const dmgSha256 = values.get("--dmg-sha256");
const teamId = values.get("--team-id");
const output = values.get("--output") ?? "dist/GUIA-BETA-pt-BR.md";
if (
  ![version, dmgUrl, dmgSha256, teamId].every(
    (value) => typeof value === "string" && value.length > 0,
  )
)
  throw new Error("Use --version, --dmg-url, --dmg-sha256 e --team-id.");
if (!/^v\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/u.test(version))
  throw new Error("A versão deve usar o formato vX.Y.Z.");
let parsedDmgUrl;
try {
  parsedDmgUrl = new URL(dmgUrl);
} catch {
  throw new Error("A URL do DMG deve ser válida.");
}
if (parsedDmgUrl.protocol !== "https:" || /[\s<>`]/u.test(dmgUrl))
  throw new Error("A URL do DMG deve usar HTTPS seguro.");
if (!/^[a-f0-9]{64}$/u.test(dmgSha256))
  throw new Error("O SHA-256 do DMG deve ter 64 caracteres hexadecimais.");
if (!/^[A-Z0-9]{10}$/u.test(teamId)) throw new Error("O Team ID da Apple é inválido.");
const guide = `# Zero Beta ${version}

## Antes de começar

Use Mac Apple Silicon, macOS 14+, 10 GB livres e internet estável. Abra Terminal
(Command + Espaço, Terminal, Enter) e copie:

\`\`\`sh
node --version
npm --version
docker version
\`\`\`

Avance somente com Node 24 ou 26, npm 11 e Docker mostrando Client e Server.
Se necessário, instale Node em https://nodejs.org/en/download e Docker Desktop em
https://docs.docker.com/desktop/setup/install/mac-install/, abra-o e aguarde
**Engine running**.

## Instale com segurança

Baixe ${dmgUrl}. Em Downloads, abra Terminal e copie este bloco para confirmar que
o arquivo baixado é o correto (o resultado deve começar com ${dmgSha256}):

\`\`\`sh
shasum -a 256 "$HOME/Downloads/Zero-Beta-${version}.dmg"
\`\`\`

Se o nome do arquivo estiver diferente, arraste o DMG para a janela do Terminal no
lugar do trecho entre aspas. Somente então abra o DMG e arraste **Zero Beta
Installer.app** para Aplicativos. No Terminal, copie este bloco antes de abrir o
aplicativo:

\`\`\`sh
codesign --verify --deep --strict --verbose=2 "/Applications/Zero Beta Installer.app" && spctl -a -vv -t execute "/Applications/Zero Beta Installer.app" && codesign -dv --verbose=4 "/Applications/Zero Beta Installer.app" 2>&1
\`\`\`

O resultado deve ser aceito e conter \`TeamIdentifier=${teamId}\`. Compare com a
mensagem de boas-vindas recebida por canal independente. Se divergir, pare.

## Crie o primeiro projeto

Abra o instalador, aceite o PATH, feche/abra Terminal e copie:

\`\`\`sh
zero --version
zero setup
zero new
\`\`\`

Responda às perguntas e copie o próximo bloco exibido pelo Zero. Para suporte use
\`zero report\`; para voltar à versão local anterior use \`zero rollback --previous\`.
`;
await mkdir(resolve(output, ".."), { recursive: true });
await writeFile(resolve(output), guide, "utf8");
