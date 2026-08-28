import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import { afterEach, describe, expect, it } from "vitest";

const temporaryDirectories: string[] = [];
const verifier = fileURLToPath(
  new URL("../../../scripts/verify-beta-release.mjs", import.meta.url),
);
const digest = (value: string): string => createHash("sha256").update(value).digest("hex");

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("beta release assets", () => {
  it("aceita somente o conjunto consistente da mesma versão", async () => {
    const directory = await mkdtemp(join(tmpdir(), "zero-beta-release-"));
    temporaryDirectories.push(directory);
    const version = "v0.1.0";
    const tarball = `zero-${version}.tgz`;
    const dmg = `Zero-Beta-Installer-${version}.dmg`;
    await Promise.all([
      writeFile(join(directory, tarball), "tarball"),
      writeFile(join(directory, dmg), "dmg"),
      writeFile(
        join(directory, "SHA256SUMS"),
        `${digest("tarball")}  ${tarball}\n${digest("dmg")}  ${dmg}\n`,
      ),
      writeFile(
        join(directory, "GUIA-BETA-pt-BR.md"),
        `# Zero Beta ${version}\nTeamIdentifier=ABCDE12345\n`,
      ),
    ]);

    const result = spawnSync(process.execPath, [verifier, version, directory, "ABCDE12345"], {
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('"verified":true');
  });
});
