import { createHash, randomBytes } from "node:crypto";
import { lstat, mkdir, open, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";

const STAGING_PREFIX = ".zero-staging-";
const RESERVATION_PREFIX = ".zero-create-";
const MAX_STAGING_ATTEMPTS = 5;
const UNSAFE_PATH_SEGMENT = /[\\\u0000]/u;
const GLOB_OR_SHELL_EXPANSION = /[\[\]*?{}$`;&|<>()]/u;
const CONTROL_OR_BIDI = /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/u;
const resolvedDestinationToken = Symbol("resolvedDestinationToken");
const resolvedDestinations = new WeakSet<object>();

export type ScaffoldErrorCode =
  | "DESTINATION_CONFLICT"
  | "INVALID_DESTINATION"
  | "INVALID_TEMPLATE"
  | "PARENT_UNAVAILABLE"
  | "WRITE_FAILED"
  | "CLEANUP_REQUIRED";

export class ScaffoldError extends Error {
  public readonly code: ScaffoldErrorCode;
  public readonly cleanupIdentifier?: string;
  public readonly cleanupIdentifiers?: readonly string[];

  public constructor(
    code: ScaffoldErrorCode,
    message: string,
    options: {
      readonly cause?: unknown;
      readonly cleanupIdentifiers?: readonly string[];
    } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "ScaffoldError";
    this.code = code;
    if (options.cleanupIdentifiers !== undefined) {
      this.cleanupIdentifiers = options.cleanupIdentifiers;
      const firstIdentifier = options.cleanupIdentifiers[0];
      if (firstIdentifier !== undefined) {
        this.cleanupIdentifier = firstIdentifier;
      }
    }
  }
}

export class ResolvedDestination {
  readonly #brand = true;

  public readonly directory: string;
  public readonly parentDirectory: string;

  private constructor(directory: string, parentDirectory: string) {
    this.directory = directory;
    this.parentDirectory = parentDirectory;
    Object.freeze(this);
  }

  public static fromValidated(
    directory: string,
    parentDirectory: string,
    token: symbol,
  ): ResolvedDestination {
    if (token !== resolvedDestinationToken) {
      fail("INVALID_DESTINATION", "O destino precisa ser obtido pelo resolvedor seguro do Zero.");
    }
    const destination = new ResolvedDestination(directory, parentDirectory);
    resolvedDestinations.add(destination);
    return destination;
  }

  public static isTrusted(destination: object): destination is ResolvedDestination {
    if (!(destination instanceof ResolvedDestination)) {
      return false;
    }

    try {
      return destination.#brand === true && resolvedDestinations.has(destination);
    } catch {
      return false;
    }
  }
}

export interface DestinationReservation {
  readonly path: string;
  readonly identifier: string;
}

export interface TemplateFile {
  readonly path: string;
  readonly contents: string | Uint8Array;
}

function fail(code: ScaffoldErrorCode, message: string): never {
  throw new ScaffoldError(code, message);
}

function expandHomeDirectory(directory: string, homeDirectory: string): string {
  if (directory === "~") {
    return homeDirectory;
  }

  if (directory.startsWith(`~${sep}`) || directory.startsWith("~/")) {
    return resolve(homeDirectory, directory.slice(2));
  }

  if (directory.startsWith("~")) {
    return fail("INVALID_DESTINATION", "Somente o prefixo ~/ pode ser expandido no diretório.");
  }

  return directory;
}

function assertSafeDirectoryInput(directory: string): void {
  if (directory.trim().length === 0) {
    fail("INVALID_DESTINATION", "O diretório do projeto é obrigatório.");
  }

  if (
    CONTROL_OR_BIDI.test(directory) ||
    GLOB_OR_SHELL_EXPANSION.test(directory) ||
    (!isAbsolute(directory) &&
      (directory.startsWith("~/") ? directory.slice(2) : directory).split("/").includes(".."))
  ) {
    fail(
      "INVALID_DESTINATION",
      "Use um caminho de pasta simples; caracteres como *, $, {, & e controles não são aceitos.",
    );
  }
}

async function assertDestinationDoesNotExist(directory: string): Promise<void> {
  try {
    const destination = await lstat(directory);
    const kind = destination.isSymbolicLink() ? "symlink" : "diretório ou arquivo";
    fail("DESTINATION_CONFLICT", `O destino já existe (${kind}): ${directory}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

export async function resolveProjectDestination(input: {
  readonly directory: string;
  readonly configurationDirectory: string;
  readonly homeDirectory?: string;
}): Promise<ResolvedDestination> {
  const normalizedDirectory = input.directory.normalize("NFC");
  assertSafeDirectoryInput(normalizedDirectory);

  const expandedDirectory = expandHomeDirectory(
    normalizedDirectory,
    input.homeDirectory ?? homedir(),
  );
  const requestedDirectory = isAbsolute(expandedDirectory)
    ? resolve(expandedDirectory)
    : resolve(input.configurationDirectory, expandedDirectory);
  const requestedParent = dirname(requestedDirectory);
  const name = basename(requestedDirectory);

  if (name === "." || name === ".." || UNSAFE_PATH_SEGMENT.test(name)) {
    fail("INVALID_DESTINATION", "O nome final do diretório é inválido.");
  }

  let canonicalParent: string;
  try {
    canonicalParent = await realpath(requestedParent);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      fail("PARENT_UNAVAILABLE", `O diretório pai não existe: ${requestedParent}`);
    }
    throw error;
  }

  const parentStats = await stat(canonicalParent);
  if (!parentStats.isDirectory()) {
    fail("PARENT_UNAVAILABLE", `O diretório pai não é um diretório: ${canonicalParent}`);
  }

  const directory = resolve(canonicalParent, name);
  if (dirname(directory) !== canonicalParent) {
    fail("INVALID_DESTINATION", "O destino precisa ser filho direto do diretório pai validado.");
  }

  await assertDestinationDoesNotExist(directory);

  return ResolvedDestination.fromValidated(directory, canonicalParent, resolvedDestinationToken);
}

function validateTemplatePath(templatePath: string): void {
  if (
    templatePath.length === 0 ||
    isAbsolute(templatePath) ||
    UNSAFE_PATH_SEGMENT.test(templatePath) ||
    CONTROL_OR_BIDI.test(templatePath) ||
    templatePath
      .split("/")
      .some((segment) => segment.length === 0 || segment === "." || segment === "..")
  ) {
    fail("INVALID_TEMPLATE", "O template contém um caminho de arquivo inválido.");
  }
}

function validateTemplateFiles(files: readonly TemplateFile[]): TemplateFile[] {
  const seenPaths = new Set<string>();
  const ordered = files
    .map((file) => ({ ...file, path: file.path.normalize("NFC") }))
    .sort((left, right) => left.path.localeCompare(right.path));

  for (const file of ordered) {
    validateTemplatePath(file.path);
    if (seenPaths.has(file.path)) {
      fail("INVALID_TEMPLATE", `O template contém arquivo duplicado: ${file.path}`);
    }
    seenPaths.add(file.path);
  }

  return ordered;
}

function assertPathInsideRoot(root: string, candidate: string): void {
  const pathFromRoot = relative(root, candidate);
  if (pathFromRoot === "" || pathFromRoot.startsWith(`..${sep}`) || isAbsolute(pathFromRoot)) {
    fail("INVALID_TEMPLATE", "O template tentou gravar fora do diretório de staging.");
  }
}

async function createStagingDirectory(parentDirectory: string): Promise<string> {
  for (let attempt = 0; attempt < MAX_STAGING_ATTEMPTS; attempt += 1) {
    const directory = resolve(
      parentDirectory,
      `${STAGING_PREFIX}${randomBytes(16).toString("hex")}`,
    );

    try {
      await mkdir(directory, { mode: 0o700 });
      return directory;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        throw error;
      }
    }
  }

  fail("WRITE_FAILED", "Não foi possível reservar um diretório temporário seguro.");
}

function assertResolvedDestination(destination: ResolvedDestination): void {
  if (!ResolvedDestination.isTrusted(destination)) {
    fail("INVALID_DESTINATION", "O destino precisa ser obtido pelo resolvedor seguro do Zero.");
  }
}

async function reserveDestination(
  destination: ResolvedDestination,
): Promise<DestinationReservation> {
  const digest = createHash("sha256").update(destination.directory).digest("hex").slice(0, 32);
  const identifier = `${RESERVATION_PREFIX}${digest}.lock`;
  const path = resolve(destination.parentDirectory, identifier);

  try {
    const handle = await open(path, "wx", 0o600);
    await handle.close();
    return { path, identifier };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      fail(
        "DESTINATION_CONFLICT",
        `Já existe uma criação em andamento ou interrompida para este destino (${identifier}). Escolha outro diretório ou inspecione o diretório pai.`,
      );
    }
    throw error;
  }
}

async function removeWorkPath(path: string): Promise<void> {
  await rm(path, { force: true, recursive: true });
}

function cleanupError(
  primaryError: ScaffoldError | undefined,
  failures: readonly { readonly identifier: string; readonly cause: unknown }[],
): ScaffoldError {
  const identifiers = failures.map((failure) => failure.identifier);
  const prefix = primaryError
    ? `${primaryError.message} `
    : "A criação foi concluída, mas a limpeza posterior falhou. ";
  return new ScaffoldError(
    "CLEANUP_REQUIRED",
    `${prefix}Inspecione manualmente ${identifiers.join(", ")} no diretório pai antes de tentar novamente.`,
    {
      cause: new AggregateError(failures.map((failure) => failure.cause)),
      cleanupIdentifiers: identifiers,
    },
  );
}

export async function materializeTemplate(
  destination: ResolvedDestination,
  files: readonly TemplateFile[],
): Promise<void> {
  assertResolvedDestination(destination);
  const orderedFiles = validateTemplateFiles(files);
  let reservation: DestinationReservation | undefined;
  let stagingDirectory: string | undefined;
  let published = false;
  let failure: ScaffoldError | undefined;

  try {
    reservation = await reserveDestination(destination);
    await assertDestinationDoesNotExist(destination.directory);
    stagingDirectory = await createStagingDirectory(destination.parentDirectory);

    for (const file of orderedFiles) {
      const target = resolve(stagingDirectory, file.path);
      assertPathInsideRoot(stagingDirectory, target);
      const targetParent = dirname(target);

      await mkdir(targetParent, { recursive: true, mode: 0o700 });
      const targetParentStats = await lstat(targetParent);
      if (!targetParentStats.isDirectory() || targetParentStats.isSymbolicLink()) {
        fail("WRITE_FAILED", `O staging contém um diretório inseguro: ${file.path}`);
      }

      await writeFile(target, file.contents, { flag: "wx", mode: 0o600 });
    }

    await assertDestinationDoesNotExist(destination.directory);
    await rename(stagingDirectory, destination.directory);
    published = true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    failure =
      error instanceof ScaffoldError
        ? error
        : new ScaffoldError(
            code === "EEXIST" || code === "ENOTEMPTY" ? "DESTINATION_CONFLICT" : "WRITE_FAILED",
            code === "EEXIST" || code === "ENOTEMPTY"
              ? "O destino passou a existir durante a criação; nada foi sobrescrito."
              : "Não foi possível materializar o scaffold com segurança.",
            { cause: error },
          );
  }

  const cleanupFailures: { readonly identifier: string; readonly cause: unknown }[] = [];
  if (!published && stagingDirectory !== undefined) {
    try {
      await removeWorkPath(stagingDirectory);
    } catch (error) {
      cleanupFailures.push({ identifier: basename(stagingDirectory), cause: error });
    }
  }

  if (reservation !== undefined) {
    try {
      await removeWorkPath(reservation.path);
    } catch (error) {
      cleanupFailures.push({ identifier: reservation.identifier, cause: error });
    }
  }

  if (cleanupFailures.length > 0) {
    throw cleanupError(failure, cleanupFailures);
  }

  if (failure !== undefined) {
    throw failure;
  }
}
