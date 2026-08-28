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
const teamId = values.get("--team-id");
const output = values.get("--output") ?? "dist/GUIA-BETA-pt-BR.md";
if (![version, dmgUrl, teamId].every((value) => typeof value === "string" && value.length > 0))
  throw new Error("Use --version, --dmg-url e --team-id.");
if (!/^https:\/\//u.test(dmgUrl)) throw new Error("A URL do DMG deve usar HTTPS.");
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

Baixe ${dmgUrl}. Em Downloads, abra o DMG e arraste **Zero Beta Installer.app**
para Aplicativos. No Terminal, copie este bloco antes de abrir o aplicativo:

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
