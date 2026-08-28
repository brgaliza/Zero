import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readlink,
  rename,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { randomUUID } from "node:crypto";

const VERSION = /^v\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/u;
const shellQuote = (value: string): string => `'${value.replace(/'/gu, "'\\\"'\\\"'")}'`;

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
    await handle.writeFile(
      JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }) + "\n",
    );
    await handle.close();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST")
      throw new Error("Outra operação do Zero já está em curso.");
    throw error;
  }
  return async () => {
    await rm(lock, { force: true });
  };
}

export async function createPrivateStaging(rootDirectory: string): Promise<string> {
  const stagingRoot = join(rootDirectory, "cli", "staging");
  await mkdir(stagingRoot, { recursive: true, mode: 0o700 });
  await chmod(stagingRoot, 0o700);
  const staging = await mkdtemp(join(stagingRoot, "install-"));
  await chmod(staging, 0o700);
  return staging;
}

export async function promoteStaging(
  rootDirectory: string,
  staging: string,
  version: string,
): Promise<void> {
  const stagingRoot = resolve(rootDirectory, "cli", "staging");
  const normalizedStaging = resolve(staging);
  const relativeStaging = relative(stagingRoot, normalizedStaging);
  if (
    relativeStaging.length === 0 ||
    relativeStaging.startsWith("..") ||
    relativeStaging === ".." ||
    relativeStaging.startsWith("/")
  )
    throw new Error("O staging de instalação é inválido.");
  const stagingInfo = await lstat(normalizedStaging);
  if (!stagingInfo.isDirectory() || stagingInfo.isSymbolicLink())
    throw new Error("O staging de instalação é inválido.");
  const destination = versionDirectory(rootDirectory, version);
  await mkdir(join(rootDirectory, "cli", "versions"), { recursive: true, mode: 0o700 });
  await rename(normalizedStaging, destination);
  await activateInstalledVersion(rootDirectory, version);
}

export async function rollbackInstalledVersion(rootDirectory: string): Promise<string> {
  const previous = await readlink(join(rootDirectory, "cli", "previous"));
  const target = previous.split("/").at(-1);
  if (target === undefined || !VERSION.test(target))
    throw new Error("Não há versão anterior instalada para rollback.");
  const targetInfo = await stat(versionDirectory(rootDirectory, target));
  if (!targetInfo.isDirectory()) throw new Error("A versão anterior instalada é inválida.");
  await activateInstalledVersion(rootDirectory, target);
  return target;
}

export async function activateInstalledVersion(
  rootDirectory: string,
  version: string,
): Promise<void> {
  const target = versionDirectory(rootDirectory, version);
  const cliDirectory = join(rootDirectory, "cli");
  const binDirectory = join(rootDirectory, "bin");
  await mkdir(cliDirectory, { recursive: true, mode: 0o700 });
  await mkdir(binDirectory, { recursive: true, mode: 0o700 });
  const targetInfo = await stat(target);
  if (!targetInfo.isDirectory()) throw new Error("A versão de instalação não está pronta.");
  const current = join(cliDirectory, "current");
  const previous = join(cliDirectory, "previous");
  try {
    const active = await readlink(current);
    const activeVersion = active.split("/").at(-1);
    if (activeVersion !== undefined && VERSION.test(activeVersion)) {
      const temporaryPrevious = join(cliDirectory, `.previous-${randomUUID()}`);
      await symlink(versionDirectory(rootDirectory, activeVersion), temporaryPrevious);
      await rename(temporaryPrevious, previous);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const temporary = join(cliDirectory, `.current-${randomUUID()}`);
  await symlink(target, temporary);
  await rename(temporary, current);
  const shim = join(binDirectory, "zero");
  await writeFile(
    shim,
    `#!/bin/sh\nexec ${shellQuote(join(rootDirectory, "cli", "current", "bin", "zero"))} "$@"\n`,
    {
      mode: 0o700,
    },
  );
  await chmod(shim, 0o700);
}
