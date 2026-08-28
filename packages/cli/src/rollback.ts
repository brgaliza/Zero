import { homedir } from "node:os";
import { join } from "node:path";
import { acquireInstallLock, rollbackInstalledVersion } from "./installer.js";

export async function runRollback(): Promise<{
  readonly ok: boolean;
  readonly exitCode: number;
  readonly code: string;
  readonly message: string;
}> {
  const root = join(homedir(), ".zero");
  try {
    const release = await acquireInstallLock(root);
    try {
      const version = await rollbackInstalledVersion(root);
      return {
        ok: true,
        exitCode: 0,
        code: "ROLLBACK_COMPLETED",
        message: `Rollback concluído para ${version}.`,
      };
    } finally {
      await release();
    }
  } catch (error) {
    return {
      ok: false,
      exitCode: 4,
      code: "ROLLBACK_UNAVAILABLE",
      message: error instanceof Error ? error.message : "Rollback indisponível.",
    };
  }
}
