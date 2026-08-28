import { chmod, mkdir, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

type SafeCheck = { readonly id: string; readonly state: string };

export async function runReport(input: {
  readonly zeroVersion: string;
  readonly checks: readonly { readonly id: string; readonly state: string }[];
  readonly homeDirectory?: string;
}): Promise<{ readonly ok: boolean; readonly exitCode: number; readonly code: string; readonly message: string }> {
  const homeDirectory = input.homeDirectory ?? homedir();
  const zeroDirectory = join(homeDirectory, ".zero");
  const directory = join(zeroDirectory, "reports");
  const destination = join(directory, "zero-report.json");
  try {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await chmod(zeroDirectory, 0o700);
    await chmod(directory, 0o700);
    const checks: SafeCheck[] = input.checks.map(({ id, state }) => ({ id, state }));
    const contents = JSON.stringify({ schemaVersion: 1, zeroVersion: input.zeroVersion, platform: process.platform, architecture: process.arch, nodeVersion: process.version, checks, timestamp: new Date().toISOString() }) + "\n";
    const temporary = join(directory, ".zero-report.json.tmp");
    await writeFile(temporary, contents, { encoding: "utf8", mode: 0o600 });
    await chmod(temporary, 0o600);
    await rename(temporary, destination);
    return { ok: true, exitCode: 0, code: "REPORT_CREATED", message: "Relatório seguro criado em ~/.zero/reports/zero-report.json." };
  } catch {
    return { ok: false, exitCode: 4, code: "REPORT_WRITE_FAILED", message: "Não foi possível criar o relatório seguro. Contate o suporte e informe este código." };
  }
}
