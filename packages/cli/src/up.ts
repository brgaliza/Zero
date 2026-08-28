import { spawn, spawnSync } from "node:child_process";
import { openSync } from "node:fs";
import { readFile, realpath } from "node:fs/promises";
import { resolve } from "node:path";

import {
  completeStage,
  assertLocalProjectOwnership,
  createLocalProjectIdentity,
  createLocalEnvironment,
  createLocalOperationState,
  findAvailablePort,
  readLocalOperationState,
  resumeCompatibility,
  withApplicationProcess,
  writeLocalProjectIdentity,
  writeLocalOperationState,
} from "../../core/src/index.js";
import { ManifestValidationError, parseProjectManifest } from "../../manifest/src/index.js";

export interface UpResult {
  readonly ok: boolean;
  readonly exitCode: number;
  readonly code: string;
  readonly message: string;
}

const localEnvironment = (): NodeJS.ProcessEnv => ({
  LANG: process.env.LANG ?? "pt_BR.UTF-8",
  PATH: process.env.PATH ?? "",
});

function execute(command: string, argumentsList: readonly string[], directory: string): void {
  const result = spawnSync(command, argumentsList, {
    cwd: directory,
    env: localEnvironment(),
    shell: false,
    stdio: "inherit",
  });
  if (result.status !== 0) throw new Error(`${command} não concluiu a etapa solicitada.`);
}

async function allocateDistinctPort(preferred: number, used: Set<number>): Promise<number> {
  let candidate = preferred;
  for (;;) {
    const port = await findAvailablePort(candidate);
    if (!used.has(port)) {
      used.add(port);
      return port;
    }
    candidate = port + 1;
  }
}

async function waitForServices(
  directory: string,
  projectName: string,
  expectedServices: readonly string[],
): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const result = spawnSync(
      "docker",
      ["compose", "--project-name", projectName, "ps", "--format", "json"],
      { cwd: directory, encoding: "utf8", env: localEnvironment(), shell: false },
    );
    if (result.status === 0) {
      const lines = result.stdout.split("\n").filter((candidate) => candidate.trim().length > 0);
      if (lines.length >= expectedServices.length) {
        try {
          const statuses = lines.map(
            (line) => JSON.parse(line) as { Service?: unknown; Health?: unknown; State?: unknown },
          );
          if (
            expectedServices.every((service) =>
              statuses.some(
                (status) =>
                  status.Service === service &&
                  status.State === "running" &&
                  status.Health === "healthy",
              ),
            )
          )
            return;
        } catch {
          // A saída transitória do Docker não é confiável; tenta novamente.
        }
      }
    }
    await new Promise<void>((resolveDelay) => setTimeout(resolveDelay, 1_000));
  }
  throw new Error("PostgreSQL não ficou saudável no tempo esperado.");
}

async function startApplication(
  directory: string,
  background: boolean,
): Promise<{ readonly exitCode: number; readonly pid?: number }> {
  const nextExecutable = resolve(directory, "node_modules/next/dist/bin/next");
  const environmentSource = await readFile(resolve(directory, ".env.local"), "utf8");
  const port = /^PORT="(\d{1,5})"$/mu.exec(environmentSource)?.[1];
  if (port === undefined || Number(port) < 1 || Number(port) > 65_535) {
    throw new Error("PORT local inválida.");
  }
  const environment = { ...localEnvironment(), PORT: port };
  if (background) {
    const output = openSync(resolve(directory, ".zero/app.local.log"), "a", 0o600);
    const child = spawn(process.execPath, [nextExecutable, "dev"], {
      cwd: directory,
      env: environment,
      shell: false,
      detached: true,
      stdio: ["ignore", output, output],
    });
    child.unref();
    return { exitCode: 0, ...(child.pid === undefined ? {} : { pid: child.pid }) };
  }
  const child = spawn(process.execPath, [nextExecutable, "dev"], {
    cwd: directory,
    env: environment,
    shell: false,
    stdio: "inherit",
  });
  const exitCode = await new Promise<number>((resolveExit) =>
    child.once("exit", (code) => resolveExit(code ?? 1)),
  );
  return { exitCode };
}

export async function runUp(
  currentDirectory = process.cwd(),
  options: { readonly background?: boolean } = {},
): Promise<UpResult> {
  try {
    const directory = await realpath(currentDirectory);
    const manifestSource = await readFile(resolve(directory, "zero.yaml"), "utf8");
    const manifest = parseProjectManifest(manifestSource).manifest;
    try {
      await assertLocalProjectOwnership(directory);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      await writeLocalProjectIdentity(
        directory,
        createLocalProjectIdentity({ projectDirectory: directory, slug: manifest.project.slug }),
      );
    }
    let journal = createLocalOperationState({ projectDirectory: directory, manifestSource });
    try {
      const existing = await readLocalOperationState(directory);
      if (resumeCompatibility(existing, { projectDirectory: directory, manifestSource }).ok)
        journal = existing;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    if (!journal.completedStages.includes("environment-created")) {
      try {
        const ports = new Set<number>();
        const databasePort = await allocateDistinctPort(5432, ports);
        const complete = manifest.profile === "complete";
        const applicationPort = await allocateDistinctPort(3000 + databasePort - 5432, ports);
        await createLocalEnvironment({
          projectDirectory: directory,
          databasePort,
          applicationPort,
          profile: manifest.profile,
          ...(complete
            ? {
                redisPort: await allocateDistinctPort(6379, ports),
                storagePort: await allocateDistinctPort(9000, ports),
                storageConsolePort: await allocateDistinctPort(9001, ports),
                emailSmtpPort: await allocateDistinctPort(1025, ports),
                emailWebPort: await allocateDistinctPort(8025, ports),
              }
            : {}),
        });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      }
      journal = completeStage(journal, "environment-created");
      await writeLocalOperationState(directory, journal);
    }
    const projectName = (await assertLocalProjectOwnership(directory)).namespace;
    if (!journal.completedStages.includes("dependencies-installed")) {
      execute("npm", ["ci", "--ignore-scripts", "--no-audit", "--no-fund"], directory);
      execute("npm", ["run", "db:generate"], directory);
      journal = completeStage(journal, "dependencies-installed");
      await writeLocalOperationState(directory, journal);
    }
    if (!journal.completedStages.includes("infrastructure-started")) {
      execute(
        "docker",
        [
          "compose",
          "--env-file",
          ".env.local",
          "--project-name",
          projectName,
          "up",
          "--detach",
          ...(manifest.profile === "complete" ? ["db", "redis", "storage", "email"] : ["db"]),
        ],
        directory,
      );
      await waitForServices(
        directory,
        projectName,
        manifest.profile === "complete" ? ["db", "redis", "storage", "email"] : ["db"],
      );
      if (manifest.profile === "complete") {
        execute(
          "docker",
          [
            "compose",
            "--env-file",
            ".env.local",
            "--project-name",
            projectName,
            "run",
            "--rm",
            "storage-init",
          ],
          directory,
        );
      }
      journal = completeStage(journal, "infrastructure-started");
      await writeLocalOperationState(directory, journal);
    }
    if (!journal.completedStages.includes("database-ready")) {
      execute("npm", ["run", "db:migrate"], directory);
      execute("npm", ["run", "db:seed"], directory);
      journal = completeStage(journal, "database-ready");
      await writeLocalOperationState(directory, journal);
    }
    const application = await startApplication(directory, options.background === true);
    if (
      application.exitCode === 0 &&
      options.background === true &&
      application.pid !== undefined
    ) {
      await writeLocalOperationState(
        directory,
        withApplicationProcess(completeStage(journal, "application-started"), application.pid),
      );
    }
    return application.exitCode === 0
      ? {
          ok: true,
          exitCode: 0,
          code: options.background === true ? "ENVIRONMENT_STARTED" : "ENVIRONMENT_STOPPED",
          message:
            options.background === true
              ? "Ambiente iniciado em segundo plano."
              : "Aplicação encerrada.",
        }
      : {
          ok: false,
          exitCode: 4,
          code: "APPLICATION_FAILED",
          message: "A aplicação foi encerrada com falha.",
        };
  } catch (error) {
    const message =
      error instanceof ManifestValidationError
        ? `zero.yaml inválido: ${error.message}`
        : "Não foi possível iniciar o ambiente local. Os dados existentes foram preservados.";
    return { ok: false, exitCode: 4, code: "ENVIRONMENT_START_FAILED", message };
  }
}
