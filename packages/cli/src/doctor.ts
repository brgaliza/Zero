import { spawnSync } from "node:child_process";
import { access, readFile, realpath } from "node:fs/promises";
import { resolve } from "node:path";

import { ManifestValidationError, parseProjectManifest } from "../../manifest/src/index.js";
import {
  assertLocalProjectOwnership,
  assertTrustedLocalDockerTransport,
} from "../../core/src/index.js";

type CheckState = "ready" | "blocked" | "unknown";

export interface DoctorCheck {
  readonly id: "project" | "environment" | "docker";
  readonly label: string;
  readonly state: CheckState;
  readonly detail: string;
  readonly action: string;
}

export interface DoctorResult {
  readonly ok: boolean;
  readonly exitCode: number;
  readonly code: string;
  readonly message: string;
  readonly checks: readonly DoctorCheck[];
}

async function dockerIsAvailable(): Promise<CheckState> {
  let environment: NodeJS.ProcessEnv;
  try {
    environment = (await assertTrustedLocalDockerTransport()).environment;
  } catch {
    return "blocked";
  }
  const result = spawnSync("docker", ["version", "--format", "{{.Server.Version}}"], {
    encoding: "utf8",
    env: environment,
    shell: false,
    timeout: 3_000,
  });
  if (result.status === 0 && result.stdout.trim().length > 0) return "ready";
  return (result.error as NodeJS.ErrnoException | undefined)?.code === "ENOENT"
    ? "blocked"
    : "unknown";
}

export async function runDoctor(currentDirectory = process.cwd()): Promise<DoctorResult> {
  let projectDirectory: string;
  let manifestSource: string;
  try {
    projectDirectory = await realpath(currentDirectory);
    manifestSource = await readFile(resolve(projectDirectory, "zero.yaml"), "utf8");
    parseProjectManifest(manifestSource);
    await assertLocalProjectOwnership(projectDirectory);
  } catch (error) {
    const message =
      error instanceof ManifestValidationError
        ? `zero.yaml inválido: ${error.message}`
        : "Não foi encontrado um projeto Zero válido neste diretório.";
    return {
      ok: false,
      exitCode: 2,
      code: "PROJECT_INVALID",
      message,
      checks: [
        {
          id: "project",
          label: "Contrato do projeto",
          state: "blocked",
          detail: message,
          action: "Execute o comando no diretório raiz de um projeto criado pelo Zero.",
        },
      ],
    };
  }
  let environment: CheckState = "ready";
  try {
    await access(resolve(projectDirectory, ".env.local"));
  } catch {
    environment = "blocked";
  }
  const docker = await dockerIsAvailable();
  const checks: DoctorCheck[] = [
    {
      id: "project",
      label: "Contrato do projeto",
      state: "ready",
      detail: "zero.yaml é compatível com esta versão do Zero.",
      action: "Nenhuma ação necessária.",
    },
    {
      id: "environment",
      label: "Ambiente local",
      state: environment,
      detail:
        environment === "ready"
          ? ".env.local está presente; seus valores não foram lidos."
          : ".env.local ainda não existe.",
      action:
        environment === "ready"
          ? "Nenhuma ação necessária."
          : "Use zero up para criar o ambiente local de forma exclusiva.",
    },
    {
      id: "docker",
      label: "Docker local",
      state: docker,
      detail:
        docker === "ready"
          ? "Daemon Docker local disponível."
          : docker === "blocked"
            ? "Docker não está instalado."
            : "Não foi possível acessar o daemon Docker local.",
      action:
        docker === "ready"
          ? "Nenhuma ação necessária."
          : "Inicie ou instale o Docker Desktop e execute zero doctor novamente.",
    },
  ];
  return {
    ok: checks.every((check) => check.state === "ready"),
    exitCode: checks.every((check) => check.state === "ready") ? 0 : 3,
    code: checks.every((check) => check.state === "ready")
      ? "PROJECT_READY"
      : "PROJECT_NEEDS_SETUP",
    message: "Diagnóstico do projeto concluído.",
    checks,
  };
}
