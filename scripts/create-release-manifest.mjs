import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const version = process.argv[2];
const directory = resolve(process.argv[3] ?? "dist/release");
if (!/^v\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/u.test(version ?? ""))
  throw new Error("Use uma tag no formato vX.Y.Z.");
const names = [
  `zero-${version}.tgz`,
  `zero-bootstrap-${version}.cjs`,
  "SHA256SUMS",
  "GUIA-BETA-pt-BR.md",
];
const digest = async (name) =>
  createHash("sha256")
    .update(await readFile(join(directory, name)))
    .digest("hex");
const assets = Object.fromEntries(
  await Promise.all(names.map(async (name) => [name, await digest(name)])),
);
await writeFile(
  join(directory, "release-manifest.json"),
  `${JSON.stringify({ schemaVersion: 1, version, assets }, null, 2)}\n`,
  { encoding: "utf8", mode: 0o600 },
);
