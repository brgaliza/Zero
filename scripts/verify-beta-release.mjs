import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const version = process.argv[2];
const directory = resolve(process.argv[3] ?? "dist/release");
if (!/^v\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/u.test(version ?? "")) throw new Error("Tag inválida.");
const names = [
  `zero-${version}.tgz`,
  `zero-bootstrap-${version}.cjs`,
  "SHA256SUMS",
  "GUIA-BETA-pt-BR.md",
];
const hash = async (name) =>
  createHash("sha256")
    .update(await readFile(join(directory, name)))
    .digest("hex");
const manifest = JSON.parse(await readFile(join(directory, "release-manifest.json"), "utf8"));
if (
  manifest.schemaVersion !== 1 ||
  manifest.version !== version ||
  Object.keys(manifest.assets ?? {}).length !== names.length
)
  throw new Error("Manifesto inválido.");
for (const name of names)
  if (manifest.assets[name] !== (await hash(name))) throw new Error(`Manifesto diverge: ${name}.`);
const sums = await readFile(join(directory, "SHA256SUMS"), "utf8");
for (const name of names.slice(0, 2))
  if (!sums.includes(`${manifest.assets[name]}  ${name}\n`))
    throw new Error(`Checksum diverge: ${name}.`);
const guide = await readFile(join(directory, "GUIA-BETA-pt-BR.md"), "utf8");
if (!guide.includes(`# Zero Beta ${version}`) || /DMG|TeamIdentifier|TODO|<[^>]+>/u.test(guide))
  throw new Error("Guia inválido.");
console.log(
  JSON.stringify({ version, assets: [...names, "release-manifest.json"], verified: true }),
);
