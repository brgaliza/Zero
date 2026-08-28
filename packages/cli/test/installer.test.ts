import { lstat, mkdtemp, readlink, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  acquireInstallLock,
  createPrivateStaging,
  promoteStaging,
  rollbackInstalledVersion,
  versionDirectory,
} from "../src/installer.js";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

describe("installer layout", () => {
  it("troca current atomicamente e mantém shim privado", async () => {
    const root = await mkdtemp(join(tmpdir(), "zero-installer-"));
    roots.push(root);
    await promoteStaging(root, await createPrivateStaging(root), "v1.2.3");
    const current = join(root, "cli", "current");
    expect((await lstat(current)).isSymbolicLink()).toBe(true);
    expect(await readlink(current)).toBe(versionDirectory(root, "v1.2.3"));
    expect((await stat(join(root, "bin", "zero"))).mode & 0o777).toBe(0o700);
  });

  it("recusa versão que não possa virar caminho", () => {
    expect(() => versionDirectory("/tmp/zero", "../v1")).toThrow("Versão de instalação inválida");
  });

  it("serializa operações concorrentes", async () => {
    const root = await mkdtemp(join(tmpdir(), "zero-installer-"));
    roots.push(root);
    const release = await acquireInstallLock(root);
    await expect(acquireInstallLock(root)).rejects.toThrow("Outra operação");
    await release();
    await expect(acquireInstallLock(root)).resolves.toBeTypeOf("function");
  });

  it("promove staging somente para a versão declarada", async () => {
    const root = await mkdtemp(join(tmpdir(), "zero-installer-"));
    roots.push(root);
    const staging = await createPrivateStaging(root);
    await promoteStaging(root, staging, "v1.2.3");
    expect(await readlink(join(root, "cli", "current"))).toBe(versionDirectory(root, "v1.2.3"));
    expect((await stat(versionDirectory(root, "v1.2.3"))).isDirectory()).toBe(true);
  });

  it("recusa staging fora do diretório privado", async () => {
    const root = await mkdtemp(join(tmpdir(), "zero-installer-"));
    const outside = await mkdtemp(join(tmpdir(), "zero-installer-outside-"));
    roots.push(root, outside);
    await expect(promoteStaging(root, outside, "v1.2.3")).rejects.toThrow("staging");
  });

  it("reverte para a versão local anterior", async () => {
    const root = await mkdtemp(join(tmpdir(), "zero-installer-"));
    roots.push(root);
    await promoteStaging(root, await createPrivateStaging(root), "v1.0.0");
    await promoteStaging(root, await createPrivateStaging(root), "v1.1.0");
    await expect(rollbackInstalledVersion(root)).resolves.toBe("v1.0.0");
    expect(await readlink(join(root, "cli", "current"))).toBe(versionDirectory(root, "v1.0.0"));
    await expect(rollbackInstalledVersion(root)).resolves.toBe("v1.1.0");
  });
});
