import { spawnSync } from "node:child_process";
import { readFile, realpath } from "node:fs/promises";
import { resolve } from "node:path";

import { assertLocalProjectOwnership } from "../../core/src/index.js";
import { ManifestValidationError, parseProjectManifest } from "../../manifest/src/index.js";

export interface LogsResult {
  readonly ok: boolean;
  readonly exitCode: number;
  readonly code: string;
  readonly message: string;
}

export async function runLogs(
  service: string | undefined,
  currentDirectory = process.cwd(),
): Promise<LogsResult> {
  if (!["db", "app", "redis", "storage", "email"].includes(service ?? "")) {
    return {
      ok: false,
      exitCode: 2,
      code: "INVALID_SERVICE",
      message: 'Use "zero logs [app|db]".',
    };
  }
  const target = service as "app" | "db" | "redis" | "storage" | "email";
  try {
    const directory = await realpath(currentDirectory);
    const manifest = parseProjectManifest(
      await readFile(resolve(directory, "zero.yaml"), "utf8"),
    ).manifest;
    const identity = await assertLocalProjectOwnership(directory);
    if (target !== "app" && target !== "db" && !manifest.services[target]) {
      return {
        ok: false,
        exitCode: 2,
        code: "SERVICE_NOT_ENABLED",
        message: `O serviço ${target} não está habilitado neste profile.`,
      };
    }
    if (target === "app") {
      const log = await readFile(resolve(directory, ".zero/app.local.log"), "utf8");
      const sanitized = log
        .replace(/postgres(?:ql)?:\/\/[^\s"']+/giu, "[DATABASE_URL ocultada]")
        .replace(/(password|token|secret)\s*[=:]\s*[^\s"']+/giu, "$1=[ocultado]");
      process.stdout.write(sanitized.slice(-64_000));
      return {
        ok: true,
        exitCode: 0,
        code: "LOGS_DISPLAYED",
        message: "Logs da aplicação exibidos.",
      };
    }
    const result = spawnSync(
      "docker",
      ["compose", "--project-name", identity.namespace, "logs", "--tail", "200", target],
      {
        cwd: directory,
        env: { LANG: process.env.LANG ?? "pt_BR.UTF-8", PATH: process.env.PATH ?? "" },
        shell: false,
        stdio: "inherit",
      },
    );
    if (result.status !== 0) throw new Error("Docker não retornou logs.");
    return {
      ok: true,
      exitCode: 0,
      code: "LOGS_DISPLAYED",
      message: `Logs de ${target} exibidos.`,
    };
  } catch (error) {
    const message =
      error instanceof ManifestValidationError
        ? `zero.yaml inválido: ${error.message}`
        : "Não foi possível consultar os logs do banco.";
    return { ok: false, exitCode: 4, code: "LOGS_FAILED", message };
  }
}
