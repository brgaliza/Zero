import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { resolve } from "node:path";

import {
  assertLocalProjectOwnership,
  assertTrustedLocalDockerTransport,
} from "../../core/src/index.js";
import { parseProjectManifest } from "../../manifest/src/index.js";

export interface BuildResult {
  readonly ok: boolean;
  readonly exitCode: number;
  readonly code: string;
  readonly message: string;
}
function docker(env: NodeJS.ProcessEnv, args: string[], cwd?: string): string {
  const result = spawnSync("docker", args, {
    cwd,
    encoding: "utf8",
    env,
    shell: false,
    timeout: 90_000,
  });
  if (result.status !== 0) throw new Error("Docker falhou.");
  return result.stdout.trim();
}
async function health(url: string): Promise<void> {
  for (let n = 0; n < 45; n += 1) {
    try {
      if ((await fetch(url, { signal: AbortSignal.timeout(1_000) })).status === 200) return;
    } catch {}
    await new Promise((done) => setTimeout(done, 1_000));
  }
  throw new Error("Health falhou.");
}

export async function runBuild(currentDirectory = process.cwd()): Promise<BuildResult> {
  let env: NodeJS.ProcessEnv | undefined;
  let tag: string | undefined;
  let network: string | undefined;
  const containers: string[] = [];
  try {
    const directory = await realpath(currentDirectory);
    const manifest = parseProjectManifest(
      await readFile(resolve(directory, "zero.yaml"), "utf8"),
    ).manifest;
    await assertLocalProjectOwnership(directory);
    env = (await assertTrustedLocalDockerTransport()).environment;
    const id = randomBytes(12).toString("hex");
    tag = `zero-build-${id}`;
    network = `zero-run-${id}-network`;
    docker(
      env,
      ["build", "--label", "zero.managed=true", "--label", `zero.run-id=${id}`, "--tag", tag, "."],
      directory,
    );
    docker(env, ["network", "create", network]);
    const password = randomBytes(18).toString("base64url");
    const db = `zero-run-${id}-db`;
    containers.push(db);
    docker(env, [
      "run",
      "-d",
      "--name",
      db,
      "--network",
      network,
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
    const port = /127\.0\.0\.1:(\d+)/u.exec(docker(env, ["port", db, "5432/tcp"]))?.[1];
    if (port === undefined) throw new Error("Porta do banco inválida.");
    const host = {
      LANG: process.env.LANG ?? "pt_BR.UTF-8",
      PATH: process.env.PATH ?? "",
      HOME: process.env.HOME ?? "",
      DATABASE_URL: `postgresql://zero:${password}@127.0.0.1:${port}/app?schema=public`,
    };
    for (const script of ["db:generate", "db:migrate"])
      if (
        spawnSync("npm", ["run", script], {
          cwd: directory,
          env: host,
          shell: false,
          timeout: 90_000,
        }).status !== 0
      )
        throw new Error("Migration falhou.");
    const app = `zero-run-${id}-app`;
    containers.push(app);
    const args = [
      "run",
      "-d",
      "--name",
      app,
      "--network",
      network,
      "-e",
      `DATABASE_URL=postgresql://zero:${password}@${db}:5432/app?schema=public`,
    ];
    if (manifest.profile === "complete") {
      const redis = `zero-run-${id}-redis`,
        storage = `zero-run-${id}-storage`,
        email = `zero-run-${id}-email`,
        redisPassword = randomBytes(18).toString("base64url"),
        storagePassword = randomBytes(18).toString("base64url");
      containers.push(redis, storage, email);
      docker(env, [
        "run",
        "-d",
        "--name",
        redis,
        "--network",
        network,
        "redis:7.4.2-bookworm",
        "redis-server",
        "--requirepass",
        redisPassword,
      ]);
      docker(env, [
        "run",
        "-d",
        "--name",
        storage,
        "--network",
        network,
        "-e",
        "MINIO_ROOT_USER=zero",
        "-e",
        `MINIO_ROOT_PASSWORD=${storagePassword}`,
        "minio/minio:RELEASE.2025-04-22T22-12-26Z",
        "server",
        "/data",
      ]);
      docker(env, ["run", "-d", "--name", email, "--network", network, "axllent/mailpit:v1.24.1"]);
      args.push(
        "-e",
        `REDIS_URL=redis://:${redisPassword}@${redis}:6379`,
        "-e",
        `STORAGE_ENDPOINT=http://${storage}:9000`,
        "-e",
        `ZERO_MAILPIT_SMTP_HOST=${email}`,
        "-e",
        "ZERO_MAILPIT_SMTP_PORT=1025",
      );
    }
    args.push("-p", "127.0.0.1::3000", tag);
    docker(env, args);
    const appPort = /127\.0\.0\.1:(\d+)/u.exec(docker(env, ["port", app, "3000/tcp"]))?.[1];
    if (appPort === undefined) throw new Error("Porta da aplicação inválida.");
    await health(`http://127.0.0.1:${appPort}/api/health`);
    return {
      ok: true,
      exitCode: 0,
      code: "BUILD_PASSED",
      message: "Imagem e health check validados.",
    };
  } catch {
    return {
      ok: false,
      exitCode: 4,
      code: "BUILD_FAILED",
      message: "Não foi possível validar a imagem de produção.",
    };
  } finally {
    if (env !== undefined) {
      for (const name of containers.reverse())
        spawnSync("docker", ["rm", "-f", name], { env, shell: false, stdio: "ignore" });
      if (network !== undefined)
        spawnSync("docker", ["network", "rm", network], { env, shell: false, stdio: "ignore" });
      if (tag !== undefined)
        spawnSync("docker", ["image", "rm", "-f", tag], { env, shell: false, stdio: "ignore" });
    }
  }
}
