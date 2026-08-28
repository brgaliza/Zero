import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const allowed = new Set([
  "--version",
  "--release-url",
  "--sha256",
  "--bootstrap-sha256",
  "--output",
]);
const values = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  const key = process.argv[index];
  const value = process.argv[index + 1];
  if (key === undefined || value === undefined || !allowed.has(key) || values.has(key))
    throw new Error("Argumentos do guia inválidos.");
  values.set(key, value);
}
const version = values.get("--version");
const releaseUrl = values.get("--release-url");
const sha256 = values.get("--sha256");
const bootstrapSha256 = values.get("--bootstrap-sha256");
const output = values.get("--output") ?? "dist/GUIA-BETA-pt-BR.md";
if (!/^v\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/u.test(version ?? "")) throw new Error("Versão inválida.");
if (!/^https:\/\/[^\s<>`]+$/u.test(releaseUrl ?? ""))
  throw new Error("A URL da release deve usar HTTPS.");
if (![sha256, bootstrapSha256].every((value) => /^[a-f0-9]{64}$/u.test(value ?? "")))
  throw new Error("Os checksums devem ter 64 caracteres hexadecimais.");
const guide = `# Zero Beta ${version}

## Antes de ler este guia

Use a mensagem de convite recebida da equipe para conferir o SHA-256 de
\`release-manifest.json\`. Baixe o manifesto e este guia da release privada,
confira os dois com \`shasum -a 256\` e só prossiga se coincidirem com o manifesto
e com a mensagem. Se houver qualquer diferença, pare e peça um novo link.

## Prepare o Mac

Abra Terminal: pressione Command + Espaço, digite \`Terminal\` e Enter. Copie:

\`\`\`sh
node --version
npm --version
docker version
\`\`\`

Você precisa de Node 24 ou 26, npm 11 e Docker mostrando Client e Server. Se
algum faltar, instale Node em https://nodejs.org/en/download e Docker Desktop em
https://docs.docker.com/desktop/setup/install/mac-install/. Abra Docker Desktop e
espere **Engine running**; depois feche e abra Terminal novamente.

## Instale o Zero

Abra ${releaseUrl} no navegador e baixe \`zero-${version}.tgz\` e
\`zero-bootstrap-${version}.cjs\`. No Terminal, copie:

\`\`\`sh
mkdir -p "$HOME/Downloads/zero-beta-${version}" && mv "$HOME/Downloads/zero-${version}.tgz" "$HOME/Downloads/zero-bootstrap-${version}.cjs" "$HOME/Downloads/zero-beta-${version}/" && cd "$HOME/Downloads/zero-beta-${version}" && shasum -a 256 zero-${version}.tgz zero-bootstrap-${version}.cjs
\`\`\`

O primeiro resultado deve começar com \`${sha256}\` e o segundo com
\`${bootstrapSha256}\`. Se não coincidirem, pare. Se coincidirem, copie:

\`\`\`sh
node "zero-bootstrap-${version}.cjs" --tarball "zero-${version}.tgz" --version "${version}" --sha256 "${sha256}" --bootstrap-sha256 "${bootstrapSha256}"
\`\`\`

Depois, feche e abra Terminal. Se escolher PATH, copie \`zero setup\`; se não,
copie \`~/.zero/bin/zero setup\`. Em seguida use \`zero new\` (ou o caminho
absoluto), responda às perguntas e siga o próximo comando mostrado. Para suporte,
use \`zero report\`; para voltar à versão anterior, \`zero rollback --previous\`.
`;
await mkdir(resolve(output, ".."), { recursive: true });
await writeFile(resolve(output), guide, "utf8");
