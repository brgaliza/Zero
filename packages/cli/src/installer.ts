import { chmod, mkdir, rename, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

const VERSION = /^v\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/u;

export function versionDirectory(rootDirectory: string, version: string): string {
  if (!VERSION.test(version)) throw new Error("Versão de instalação inválida.");
  return join(rootDirectory, "cli", "versions", version);
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
