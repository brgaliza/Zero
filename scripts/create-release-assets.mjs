import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const version = process.argv[2];
const output = resolve(process.argv[3] ?? "dist/release");
if (!/^v\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/u.test(version ?? "")) {
  throw new Error("Use uma tag no formato vX.Y.Z.");
}
await mkdir(output, { recursive: true, mode: 0o700 });
const packageMetadata = JSON.parse(await readFile("packages/cli/package.json", "utf8"));
if (packageMetadata.version !== version.slice(1))
  throw new Error("A tag diverge da versão do pacote.");
const packed = JSON.parse(
  execFileSync(
    "npm",
    [
      "pack",
      "--workspace=@brunogaliza/zero",
      "--ignore-scripts",
      "--json",
      `--pack-destination=${output}`,
    ],
    { encoding: "utf8" },
  ),
);
const sourceName = packed[0]?.filename;
if (typeof sourceName !== "string") throw new Error("npm pack não retornou um tarball.");
const source = join(output, basename(sourceName));
const targetName = `zero-${version}.tgz`;
const target = join(output, targetName);
await rename(source, target);
const bootstrapName = `zero-bootstrap-${version}.cjs`;
await copyFile("packages/cli/dist/bootstrap.cjs", join(output, bootstrapName));
const digest = async (path) =>
  createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
const tarballSha256 = await digest(target);
const bootstrapSha256 = await digest(join(output, bootstrapName));
await writeFile(
  join(output, "SHA256SUMS"),
  `${tarballSha256}  ${targetName}\n${bootstrapSha256}  ${bootstrapName}\n`,
  {
    encoding: "utf8",
    mode: 0o600,
  },
);
console.log(JSON.stringify({ version, tarball: targetName, tarballSha256, bootstrapSha256 }));
