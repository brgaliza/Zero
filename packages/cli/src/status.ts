import { spawnSync } from "node:child_process";
import { readFile, realpath } from "node:fs/promises";
import { resolve } from "node:path";

import {
  assertLocalProjectOwnership,
  readLocalOperationState,
  resumeCompatibility,
} from "../../core/src/index.js";
import { ManifestValidationError, parseProjectManifest } from "../../manifest/src/index.js";

export interface StatusResult {
  readonly ok: boolean;
  readonly exitCode: number;
  readonly code: string;
  readonly message: string;
  readonly services?: readonly {
    readonly name: string;
    readonly state: string;
    readonly health: string;
  }[];
}

export async function runStatus(currentDirectory = process.cwd()): Promise<StatusResult> {
  try {
    const directory = await realpath(currentDirectory);
    const manifestSource = await readFile(resolve(directory, "zero.yaml"), "utf8");
    parseProjectManifest(manifestSource);
    const identity = await assertLocalProjectOwnership(directory);
    const result = spawnSync(
      "docker",
      ["compose", "--project-name", identity.namespace, "ps", "--format", "json"],
      {
        cwd: directory,
        encoding: "utf8",
        env: { LANG: process.env.LANG ?? "pt_BR.UTF-8", PATH: process.env.PATH ?? "" },
        shell: false,
      },
    );
    if (result.status !== 0) throw new Error("Docker não respondeu ao status.");
    const lines = result.stdout.split("\n").filter((line) => line.trim().length > 0);
    const services: { name: string; state: string; health: string }[] = lines.map((line) => {
      const service = JSON.parse(line) as { Service?: unknown; State?: unknown; Health?: unknown };
      return {
        name: typeof service.Service === "string" ? service.Service : "desconhecido",
        state: typeof service.State === "string" ? service.State : "desconhecido",
        health: typeof service.Health === "string" ? service.Health : "não informado",
      };
    });
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
        services.push({
          name: "app",
          state: command.includes(resolve(directory, "node_modules/next/dist/bin/next"))
            ? "running"
            : "stopped",
          health: "não verificado",
        });
      }
    } catch {
      // Estado local ausente ou inválido não impede o status de Docker.
    }
    return services.length > 0
      ? {
          ok: true,
          exitCode: 0,
          code: "ENVIRONMENT_RUNNING",
          message: `${services.length} serviço(s) encontrado(s).`,
          services,
        }
      : {
          ok: false,
          exitCode: 3,
          code: "ENVIRONMENT_STOPPED",
          message: "Nenhum serviço local está em execução.",
          services,
        };
  } catch (error) {
    const message =
      error instanceof ManifestValidationError
        ? `zero.yaml inválido: ${error.message}`
        : "Não foi possível consultar o estado do ambiente local.";
    return { ok: false, exitCode: 4, code: "STATUS_FAILED", message };
  }
}
