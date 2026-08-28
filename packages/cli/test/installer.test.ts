import { lstat, mkdtemp, readlink, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { activateInstalledVersion, versionDirectory } from "../src/installer.js";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true }))); });

describe("installer layout", () => {
  it("troca current atomicamente e mantém shim privado", async () => {
    const root = await mkdtemp(join(tmpdir(), "zero-installer-"));
    roots.push(root);
    await activateInstalledVersion(root, "v1.2.3");
    const current = join(root, "cli", "current");
    expect((await lstat(current)).isSymbolicLink()).toBe(true);
    expect(await readlink(current)).toBe(versionDirectory(root, "v1.2.3"));
    expect((await stat(join(root, "bin", "zero"))).mode & 0o777).toBe(0o700);
  });

  it("recusa versão que não possa virar caminho", () => {
    expect(() => versionDirectory("/tmp/zero", "../v1")).toThrow("Versão de instalação inválida");
  });
});
