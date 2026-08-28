import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";

import { createPrivateStaging, promoteStaging } from "./installer.js";

const VERSION = /^v\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const hash = async (path: string): Promise<string> =>
  createHash("sha256")
    .update(await readFile(path))
    .digest("hex");

type BootstrapOptions = {
  readonly tarball: string;
  readonly version: string;
  readonly sha256: string;
  readonly bootstrapSha256: string;
  readonly script: string;
  readonly homeDirectory?: string;
};

function parseArguments(argumentsList: readonly string[]): BootstrapOptions {
  const values = new Map<string, string>();
  for (let index = 0; index < argumentsList.length; index += 2) {
    const key = argumentsList[index];
    const value = argumentsList[index + 1];
    if (
      key === undefined ||
      value === undefined ||
      !["--tarball", "--version", "--sha256", "--bootstrap-sha256"].includes(key) ||
      values.has(key)
    )
      throw new Error("Argumentos de instalação inválidos.");
    values.set(key, value);
  }
  const tarball = values.get("--tarball");
  const version = values.get("--version");
  const sha256 = values.get("--sha256");
  const bootstrapSha256 = values.get("--bootstrap-sha256");
  if (
    values.size !== 4 ||
    tarball === undefined ||
    version === undefined ||
    sha256 === undefined ||
    bootstrapSha256 === undefined ||
    !VERSION.test(version) ||
    !SHA256.test(sha256) ||
    !SHA256.test(bootstrapSha256)
  )
    throw new Error("Argumentos de instalação inválidos.");
  return {
    tarball: resolve(tarball),
    version,
    sha256,
    bootstrapSha256,
    script: resolve(process.argv[1] ?? ""),
  };
}

async function validatePackage(directory: string, version: string): Promise<void> {
  const metadata = JSON.parse(await readFile(join(directory, "package.json"), "utf8")) as Record<
    string,
    unknown
  >;
  if (
    metadata.name !== "@brunogaliza/zero" ||
    metadata.version !== version.slice(1) ||
    metadata.private !== false ||
    metadata.bin === undefined ||
    metadata.scripts !== undefined ||
    metadata.dependencies !== undefined ||
    metadata.optionalDependencies !== undefined ||
    metadata.peerDependencies !== undefined ||
    metadata.bundledDependencies !== undefined
  )
    throw new Error("O pacote de instalação é inválido.");
}

export async function runBootstrap(options: BootstrapOptions): Promise<void> {
  const root = join(options.homeDirectory ?? homedir(), ".zero");
  const bootstrap = join(root, "bootstrap");
  try {
    if (
      (await hash(options.tarball)) !== options.sha256 ||
      (await hash(options.script)) !== options.bootstrapSha256
    )
      throw new Error("O checksum da instalação não confere.");
    await mkdir(bootstrap, { recursive: true, mode: 0o700 });
    execFileSync(
      "npm",
      [
        "install",
        "--offline",
        "--ignore-scripts",
        "--no-package-lock",
        "--no-audit",
        "--no-fund",
        "--prefix",
        bootstrap,
        options.tarball,
      ],
      {
        env: {
          HOME: root,
          PATH: process.env.PATH ?? "",
          npm_config_cache: join(bootstrap, "cache"),
          npm_config_userconfig: join(bootstrap, "npmrc"),
          npm_config_globalconfig: join(bootstrap, "npmrc"),
        },
        stdio: "ignore",
      },
    );
    const packageDirectory = join(bootstrap, "node_modules", "@brunogaliza", "zero");
    await validatePackage(packageDirectory, options.version);
    const staging = await createPrivateStaging(root);
    await cp(packageDirectory, join(staging, "package"), { recursive: true, dereference: false });
    const executable = join(staging, "bin", "zero");
    await mkdir(join(staging, "bin"), { recursive: true, mode: 0o700 });
    await writeFile(
      executable,
      `#!/bin/sh\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(join(staging, "package", "dist", "main.js"))} "$@"\n`,
      { mode: 0o700 },
    );
    await promoteStaging(root, staging, options.version);
  } catch {
    throw new Error("Não foi possível instalar o Zero com segurança.");
  } finally {
    await rm(bootstrap, { recursive: true, force: true });
  }
}

if (process.argv[1] !== undefined && basename(process.argv[1]).includes("bootstrap")) {
  runBootstrap(parseArguments(process.argv.slice(2))).catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : "Não foi possível instalar o Zero com segurança."}\n`,
    );
    process.exitCode = 4;
  });
}
