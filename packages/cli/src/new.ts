import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import {
  createProjectManifest,
  ManifestValidationError,
  parseNewProjectConfig,
  type NewProjectConfig,
  type TemplateLock,
} from "../../manifest/src/index.js";
import {
  materializeTemplate,
  renderEssentialProjectFiles,
  resolveProjectDestination,
  ScaffoldError,
  type TemplateFile,
} from "../../scaffold/src/index.js";

const staticPaths = [
  ".env.example",
  "AGENTS.md",
  "CLAUDE.md",
  "app/api/health/route.ts",
  "app/globals.css",
  "gitignore",
  "next-env.d.ts",
  "prisma/schema.prisma",
  "tsconfig.json",
] as const;

export interface NewRuntime {
  readonly nodeVersion: string;
  readonly npmVersion: string | undefined;
  readonly currentDirectory: string;
  readonly templateDirectory: string;
  readonly isInteractive: boolean;
  prompt(question: string): Promise<string>;
  readConfig(path: string): Promise<string>;
}
export interface NewResult {
  readonly ok: boolean;
  readonly exitCode: number;
  readonly code: string;
  readonly message: string;
  readonly nextAction?: string;
  readonly result?: { readonly directory: string; readonly slug: string };
}
const fail = (exitCode: number, code: string, message: string, nextAction?: string): NewResult => ({
  ok: false,
  exitCode,
  code,
  message,
  ...(nextAction === undefined ? {} : { nextAction }),
});
const major = (value: string | undefined): number | undefined => {
  const match = /^v?(\d+)/u.exec(value?.trim() ?? "");
  return match?.[1] === undefined ? undefined : Number(match[1]);
};
function preflight(runtime: NewRuntime): NewResult | undefined {
  if (major(runtime.nodeVersion) !== 24)
    return fail(
      3,
      "PREFLIGHT_NODE_UNSUPPORTED",
      "zero new requer Node.js 24.",
      "Execute zero setup para diagnosticar a instalação.",
    );
  if (major(runtime.npmVersion) !== 11)
    return fail(
      3,
      "PREFLIGHT_NPM_UNSUPPORTED",
      "zero new requer npm 11.",
      "Execute zero setup para diagnosticar a instalação.",
    );
  return undefined;
}
function configFor(
  name: string,
  description: string,
  slug: string,
  directory: string,
): NewProjectConfig {
  return parseNewProjectConfig(
    "schemaVersion: 1\nproject:\n  name: " +
      JSON.stringify(name) +
      "\n  description: " +
      JSON.stringify(description) +
      "\n  slug: " +
      JSON.stringify(slug) +
      "\n  directory: " +
      JSON.stringify(directory) +
      "\nprofile: essential\ninitialization:\n  start: false\n  git: false\n  github:\n    createPrivateRepository: false\n",
  );
}
function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 63);
}
async function create(
  config: NewProjectConfig,
  configurationDirectory: string,
  runtime: NewRuntime,
): Promise<{ directory: string; slug: string }> {
  const template = runtime.templateDirectory;
  const staticFiles = await Promise.all(
    staticPaths.map(async (source): Promise<TemplateFile> => ({
      path: source === "gitignore" ? ".gitignore" : source,
      contents: await readFile(resolve(template, source), "utf8"),
    })),
  );
  const [packageLock, lockSource] = await Promise.all([
    readFile(resolve(template, "package-lock.json"), "utf8"),
    readFile(resolve(template, ".zero/template.lock.json"), "utf8"),
  ]);
  const files = new Map(staticFiles.map((file) => [file.path, file]));
  const templateLock = JSON.parse(lockSource) as TemplateLock;
  for (const file of renderEssentialProjectFiles({
    manifest: createProjectManifest(config),
    packageLock,
    templateLock: { ...templateLock, cliVersion: process.env.ZERO_VERSION ?? "0.0.0-development" },
  }))
    files.set(file.path, file);
  const destination = await resolveProjectDestination({
    directory: config.project.directory,
    configurationDirectory,
  });
  await materializeTemplate(destination, [...files.values()]);
  return { directory: destination.directory, slug: config.project.slug };
}
function fromError(error: unknown): NewResult {
  if (error instanceof ManifestValidationError)
    return fail(2, "CONFIG_INVALID", error.message, "Corrija os dados e tente novamente.");
  if (error instanceof ScaffoldError) {
    if (error.code === "DESTINATION_CONFLICT")
      return fail(5, "DESTINATION_CONFLICT", error.message);
    if (error.code === "INVALID_DESTINATION") return fail(2, "CONFIG_INVALID", error.message);
    return fail(4, "FILESYSTEM_WRITE_FAILED", error.message);
  }
  return fail(4, "FILESYSTEM_WRITE_FAILED", "Não foi possível criar a fundação do projeto.");
}
export async function runDeclarative(
  configArgument: string | undefined,
  yes: boolean,
  runtime: NewRuntime,
): Promise<NewResult> {
  if (configArgument === undefined || !yes)
    return fail(2, "INVALID_ARGUMENTS", "Use exatamente: zero new --config <arquivo> --yes.");
  const blocked = preflight(runtime);
  if (blocked !== undefined) return blocked;
  const configPath = resolve(runtime.currentDirectory, configArgument);
  try {
    const result = await create(
      parseNewProjectConfig(await runtime.readConfig(configPath)),
      dirname(configPath),
      runtime,
    );
    return {
      ok: true,
      exitCode: 0,
      code: "PROJECT_CREATED",
      message: "Fundação criada.",
      nextAction: "O ambiente funcional será entregue na Sprint 2.",
      result,
    };
  } catch (error) {
    return fromError(error);
  }
}
export async function runGuided(runtime: NewRuntime): Promise<NewResult> {
  if (!runtime.isInteractive)
    return fail(2, "INTERACTIVE_TTY_REQUIRED", "zero new requer um terminal interativo.");
  const blocked = preflight(runtime);
  if (blocked !== undefined) return blocked;
  try {
    const name = (await runtime.prompt("Nome do projeto: ")).trim();
    const description = (await runtime.prompt("Descrição: ")).trim();
    const suggestedSlug = slugify(name);
    const slug = (await runtime.prompt("Slug [" + suggestedSlug + "]: ")).trim() || suggestedSlug;
    const suggestedDirectory = "~/Projetos/" + slug;
    const directory =
      (await runtime.prompt("Pasta [" + suggestedDirectory + "]: ")).trim() || suggestedDirectory;
    const config = configFor(name, description, slug, directory);
    stdout.write(
      "\nResumo\nNome: " +
        config.project.name +
        "\nSlug: " +
        config.project.slug +
        "\nDestino: " +
        config.project.directory +
        "\nImpacto: cria arquivos.\n",
    );
    const confirmation = (await runtime.prompt("Criar a fundação? [s/N]: ")).trim().toLowerCase();
    if (confirmation !== "s" && confirmation !== "sim")
      return fail(2, "CANCELLED", "Criação cancelada; nenhum arquivo foi alterado.");
    return {
      ok: true,
      exitCode: 0,
      code: "PROJECT_CREATED",
      message: "Fundação criada.",
      result: await create(config, runtime.currentDirectory, runtime),
    };
  } catch (error) {
    return fromError(error);
  }
}
export function defaultNewRuntime(input: {
  nodeVersion: string;
  npmVersion: string | undefined;
}): NewRuntime {
  return {
    ...input,
    currentDirectory: process.cwd(),
    templateDirectory: resolve(__dirname, "../templates/next-fullstack/essential"),
    isInteractive: stdin.isTTY === true && stdout.isTTY === true,
    prompt: async (question) => {
      const terminal = createInterface({ input: stdin, output: stdout });
      try {
        return await terminal.question(question);
      } finally {
        terminal.close();
      }
    },
    readConfig: async (path) => readFile(path, "utf8"),
  };
}
