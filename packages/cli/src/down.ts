import { spawnSync } from "node:child_process";
import { readFile, realpath } from "node:fs/promises";
import { resolve } from "node:path";

import {
  assertLocalProjectOwnership,
  readLocalOperationState,
  resumeCompatibility,
} from "../../core/src/index.js";
import { ManifestValidationError, parseProjectManifest } from "../../manifest/src/index.js";

export interface DownResult {
  readonly ok: boolean;
  readonly exitCode: number;
  readonly code: string;
  readonly message: string;
}

export async function runDown(currentDirectory = process.cwd()): Promise<DownResult> {
  try {
    const directory = await realpath(currentDirectory);
    const manifestSource = await readFile(resolve(directory, "zero.yaml"), "utf8");
    parseProjectManifest(manifestSource);
    const identity = await assertLocalProjectOwnership(directory);
    try {
      const state = await readLocalOperationState(directory);
      if (
        resumeCompatibility(state, { projectDirectory: directory, manifestSource }).ok &&
        state.application
      ) {
        const command = spawnSync("ps", ["-o", "command=", "-p", String(state.application.pid)], {
          encoding: "utf8",
          env: { PATH: process.env.PATH ?? "" },
          shell: false,
        }).stdout;
        const expectedPath = resolve(directory, "node_modules/next/dist/bin/next");
        if (command.includes(expectedPath)) {
          try {
            process.kill(-state.application.pid, "SIGINT");
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
          }
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    const result = spawnSync(
      "docker",
      ["compose", "--env-file", ".env.local", "--project-name", identity.namespace, "down"],
      {
        cwd: directory,
        env: { LANG: process.env.LANG ?? "pt_BR.UTF-8", PATH: process.env.PATH ?? "" },
        shell: false,
        stdio: "inherit",
      },
    );
    if (result.status !== 0) throw new Error("Docker não concluiu o encerramento.");
    return {
      ok: true,
      exitCode: 0,
      code: "ENVIRONMENT_STOPPED",
      message: "Infraestrutura local encerrada; volumes foram preservados.",
    };
  } catch (error) {
    const message =
      error instanceof ManifestValidationError
        ? `zero.yaml inválido: ${error.message}`
        : "Não foi possível encerrar o ambiente local; nenhum volume foi removido.";
    return { ok: false, exitCode: 4, code: "ENVIRONMENT_STOP_FAILED", message };
  }
}
