import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const version = process.argv[2];
const output = resolve(process.argv[3] ?? "dist/release");
if (!/^v\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/u.test(version ?? "")) {
  throw new Error("Use uma tag no formato vX.Y.Z.");
}
await mkdir(output, { recursive: true, mode: 0o700 });
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
const digest = createHash("sha256")
  .update(await readFile(target))
  .digest("hex");
await writeFile(join(output, "SHA256SUMS"), `${digest}  ${targetName}\n`, {
  encoding: "utf8",
  mode: 0o600,
});
await copyFile(target, join(output, `${targetName}.verified-copy`));
const verifiedCopy = join(output, `${targetName}.verified-copy`);
const verified = createHash("sha256")
  .update(await readFile(verifiedCopy))
  .digest("hex");
if (verified !== digest) throw new Error("O asset baixado para verificação diverge do checksum.");
await unlink(verifiedCopy);
console.log(JSON.stringify({ version, tarball: targetName, sha256: digest }));
