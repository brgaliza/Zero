import { chmod, mkdir, mkdtemp, open, readdir, readlink, rename, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

const VERSION = /^v\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/u;

export function versionDirectory(rootDirectory: string, version: string): string {
  if (!VERSION.test(version)) throw new Error("Versão de instalação inválida.");
  return join(rootDirectory, "cli", "versions", version);
}

export async function acquireInstallLock(rootDirectory: string): Promise<() => Promise<void>> {
  const cliDirectory = join(rootDirectory, "cli");
  await mkdir(cliDirectory, { recursive: true, mode: 0o700 });
  const lock = join(cliDirectory, ".operation.lock");
  try {
    const handle = await open(lock, "wx", 0o600);
    await handle.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }) + "\n");
    await handle.close();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Error("Outra operação do Zero já está em curso.");
    throw error;
  }
  return async () => { await rm(lock, { force: true }); };
}

export async function createPrivateStaging(rootDirectory: string): Promise<string> {
  const stagingRoot = join(rootDirectory, "cli", "staging");
  await mkdir(stagingRoot, { recursive: true, mode: 0o700 });
  await chmod(stagingRoot, 0o700);
  const staging = await mkdtemp(join(stagingRoot, "install-"));
  await chmod(staging, 0o700);
  return staging;
}

export async function promoteStaging(rootDirectory: string, staging: string, version: string): Promise<void> {
  const destination = versionDirectory(rootDirectory, version);
  await mkdir(join(rootDirectory, "cli", "versions"), { recursive: true, mode: 0o700 });
  await rename(staging, destination);
  await activateInstalledVersion(rootDirectory, version);
}

export async function rollbackInstalledVersion(rootDirectory: string): Promise<string> {
  const current = await readlink(join(rootDirectory, "cli", "current"));
  const currentVersion = current.split("/").at(-1);
  if (currentVersion === undefined) throw new Error("Versão ativa inválida.");
  const versions = (await readdir(join(rootDirectory, "cli", "versions"))).filter((version) => VERSION.test(version)).sort();
  const candidates = versions.filter((version) => version !== currentVersion);
  const target = candidates.at(-1);
  if (target === undefined) throw new Error("Não há versão anterior instalada para rollback.");
  await activateInstalledVersion(rootDirectory, target);
  return target;
}

export async function activateInstalledVersion(rootDirectory: string, version: string): Promise<void> {
  const target = versionDirectory(rootDirectory, version);
  const cliDirectory = join(rootDirectory, "cli");
  const binDirectory = join(rootDirectory, "bin");
  await mkdir(cliDirectory, { recursive: true, mode: 0o700 });
  await mkdir(binDirectory, { recursive: true, mode: 0o700 });
  const current = join(cliDirectory, "current");
  const temporary = join(cliDirectory, ".current.next");
  await symlink(target, temporary);
  await rename(temporary, current);
  const shim = join(binDirectory, "zero");
  await writeFile(shim, "#!/bin/sh\nexec \"$HOME/.zero/cli/current/bin/zero\" \"$@\"\n", { mode: 0o700 });
  await chmod(shim, 0o700);
}
