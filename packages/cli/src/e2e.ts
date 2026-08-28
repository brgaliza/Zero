import { randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { readFile, realpath } from "node:fs/promises";
import { createServer } from "node:net";
import { resolve } from "node:path";

import {
  assertLocalProjectOwnership,
  assertTrustedLocalDockerTransport,
} from "../../core/src/index.js";
import { parseProjectManifest } from "../../manifest/src/index.js";

type DockerEnvironment = NodeJS.ProcessEnv;

function runDocker(environment: DockerEnvironment, argumentsList: string[]): string {
  const result = spawnSync("docker", argumentsList, {
    encoding: "utf8",
    env: environment,
    shell: false,
    timeout: 60_000,
  });
  if (result.status !== 0) throw new Error("Docker falhou.");
  return result.stdout.trim();
}

function dockerPort(environment: DockerEnvironment, container: string, port: number): number {
  const output = runDocker(environment, ["port", container, `${port}/tcp`]);
  const match = /127\.0\.0\.1:(\d{1,5})/u.exec(output);
  if (match?.[1] === undefined) throw new Error("Docker não publicou uma porta loopback.");
  return Number(match[1]);
}

async function freePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen({ host: "127.0.0.1", port: 0 }, () => {
      const address = server.address();
      server.close((error) =>
        error === undefined && address !== null && typeof address === "object"
          ? resolvePort(address.port)
          : reject(error),
      );
    });
  });
}

async function waitFor(url: string, predicate: (response: Response) => boolean): Promise<void> {
  for (let attempt = 0; attempt < 45; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1_000) });
      if (predicate(response)) return;
    } catch {
      /* retry */
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 1_000));
  }
  throw new Error("Serviço não ficou saudável no tempo esperado.");
}

export async function runIsolatedE2e(currentDirectory = process.cwd()): Promise<void> {
  const directory = await realpath(currentDirectory);
  const manifest = parseProjectManifest(
    await readFile(resolve(directory, "zero.yaml"), "utf8"),
  ).manifest;
  await assertLocalProjectOwnership(directory);
  const docker = await assertTrustedLocalDockerTransport();
  const runId = randomBytes(12).toString("hex");
  const names: string[] = [];
  let application: ReturnType<typeof spawn> | undefined;
  try {
    const password = randomBytes(18).toString("base64url");
    const database = `zero-run-${runId}-db`;
    names.push(database);
    runDocker(docker.environment, [
      "run",
      "--detach",
      "--name",
      database,
      "--label",
      "zero.managed=true",
      "--label",
      `zero.run-id=${runId}`,
      "-e",
      "POSTGRES_USER=zero",
      "-e",
      `POSTGRES_PASSWORD=${password}`,
      "-e",
      "POSTGRES_DB=app",
      "-p",
      "127.0.0.1::5432",
      "postgres:17.6-bookworm",
    ]);
    const databasePort = dockerPort(docker.environment, database, 5432);
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const probe = spawnSync(
        "docker",
        ["exec", database, "pg_isready", "-U", "zero", "-d", "app"],
        { env: docker.environment, shell: false },
      );
      if (probe.status === 0) break;
      if (attempt === 29) throw new Error("PostgreSQL efêmero não ficou pronto.");
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 1_000));
    }
    const environment: NodeJS.ProcessEnv = {
      LANG: process.env.LANG ?? "pt_BR.UTF-8",
      PATH: process.env.PATH ?? "",
      HOME: process.env.HOME ?? "",
      DATABASE_URL: `postgresql://zero:${password}@127.0.0.1:${databasePort}/app?schema=public`,
    };
    if (manifest.profile === "complete") {
      const redisPassword = randomBytes(18).toString("base64url");
      const redis = `zero-run-${runId}-redis`;
      const storage = `zero-run-${runId}-storage`;
      const email = `zero-run-${runId}-email`;
      names.push(redis, storage, email);
      runDocker(docker.environment, [
        "run",
        "--detach",
        "--name",
        redis,
        "--label",
        "zero.managed=true",
        "--label",
        `zero.run-id=${runId}`,
        "-p",
        "127.0.0.1::6379",
        "redis:7.4.2-bookworm",
        "redis-server",
        "--requirepass",
        redisPassword,
      ]);
      const storagePassword = randomBytes(18).toString("base64url");
      runDocker(docker.environment, [
        "run",
        "--detach",
        "--name",
        storage,
        "--label",
        "zero.managed=true",
        "--label",
        `zero.run-id=${runId}`,
        "-e",
        "MINIO_ROOT_USER=zero",
        "-e",
        `MINIO_ROOT_PASSWORD=${storagePassword}`,
        "-p",
        "127.0.0.1::9000",
        "minio/minio:RELEASE.2025-04-22T22-12-26Z",
        "server",
        "/data",
      ]);
      runDocker(docker.environment, [
        "run",
        "--detach",
        "--name",
        email,
        "--label",
        "zero.managed=true",
        "--label",
        `zero.run-id=${runId}`,
        "-p",
        "127.0.0.1::1025",
        "axllent/mailpit:v1.24.1",
      ]);
      const redisPort = dockerPort(docker.environment, redis, 6379);
      const storagePort = dockerPort(docker.environment, storage, 9000);
      const emailPort = dockerPort(docker.environment, email, 1025);
      await waitFor(`http://127.0.0.1:${storagePort}/minio/health/live`, (response) => response.ok);
      Object.assign(environment, {
        REDIS_URL: `redis://:${redisPassword}@127.0.0.1:${redisPort}`,
        ZERO_MINIO_API_PORT: String(storagePort),
        ZERO_MAILPIT_SMTP_PORT: String(emailPort),
      });
    }
    const generate = spawnSync("npm", ["run", "db:generate"], {
      cwd: directory,
      env: environment,
      shell: false,
      timeout: 60_000,
    });
    const migrate = spawnSync("npm", ["run", "db:migrate"], {
      cwd: directory,
      env: environment,
      shell: false,
      timeout: 60_000,
    });
    const seed = spawnSync("npm", ["run", "db:seed"], {
      cwd: directory,
      env: environment,
      shell: false,
      timeout: 60_000,
    });
    if (generate.status !== 0 || migrate.status !== 0 || seed.status !== 0)
      throw new Error(
        `Preparação efêmera falhou (${generate.status}/${migrate.status}/${seed.status}).`,
      );
    const appPort = await freePort();
    application = spawn("npm", ["run", "dev", "--", "--hostname", "127.0.0.1"], {
      cwd: directory,
      env: { ...environment, PORT: String(appPort) },
      shell: false,
      detached: true,
      stdio: "ignore",
    });
    application.unref();
    await waitFor(`http://127.0.0.1:${appPort}/api/health`, (response) => response.status === 200);
  } finally {
    if (application?.pid !== undefined) {
      try {
        process.kill(-application.pid, "SIGINT");
      } catch {
        /* process exited */
      }
    }
    for (const name of names.reverse())
      spawnSync("docker", ["rm", "--force", name], {
        env: docker.environment,
        shell: false,
        stdio: "ignore",
      });
  }
}
