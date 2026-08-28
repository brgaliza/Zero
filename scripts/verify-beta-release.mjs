import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const version = process.argv[2];
const directory = resolve(process.argv[3] ?? "dist/release");
const teamId = process.argv[4];
if (!/^v\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/u.test(version ?? ""))
  throw new Error("Use uma tag no formato vX.Y.Z.");
if (!/^[A-Z0-9]{10}$/u.test(teamId ?? "")) throw new Error("Informe um Team ID Apple válido.");

const names = [`zero-${version}.tgz`, `Zero-Beta-Installer-${version}.dmg`];
const sums = await readFile(join(directory, "SHA256SUMS"), "utf8");
const lines = sums.trim().split("\n");
const expected = new Map(
  lines.map((line) => {
    const match = /^([a-f0-9]{64})  ([A-Za-z0-9._-]+)$/u.exec(line);
    if (match?.[1] === undefined || match[2] === undefined)
      throw new Error("SHA256SUMS usa formato inválido.");
    return [match[2], match[1]];
  }),
);
if (
  lines.length !== names.length ||
  expected.size !== names.length ||
  names.some((name) => !expected.has(name))
)
  throw new Error("SHA256SUMS deve conter exatamente o tarball e o DMG da mesma versão.");
for (const name of names) {
  const actual = createHash("sha256")
    .update(await readFile(join(directory, name)))
    .digest("hex");
  if (actual !== expected.get(name)) throw new Error(`Checksum inválido para ${name}.`);
}
const guide = await readFile(join(directory, "GUIA-BETA-pt-BR.md"), "utf8");
if (!guide.includes(`# Zero Beta ${version}`) || !guide.includes(`TeamIdentifier=${teamId}`))
  throw new Error("O guia não corresponde à versão ou ao Team ID da release.");
if (/\bTODO\b|<[^>]+>/u.test(guide)) throw new Error("O guia contém um placeholder.");
console.log(JSON.stringify({ version, assets: names, verified: true }));
