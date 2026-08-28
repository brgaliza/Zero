import { isAlias, isMap, isScalar, isSeq, parseAllDocuments, type Node } from "yaml";

export const CONFIG_SCHEMA_VERSION = 1;
export const MAX_CONFIG_SIZE_BYTES = 16_384;

const MAX_DEPTH = 10;
const RESERVED_SLUGS = new Set(["zero", "admin", "api", "root", "null", "undefined"]);
const CONTROL_OR_BIDI = /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u;
const SLUG_PATTERN = /^[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export type ValidationCode =
  "INVALID_DOCUMENT" | "INVALID_TYPE" | "INVALID_VALUE" | "MISSING_FIELD" | "UNKNOWN_FIELD";

export interface ValidationIssue {
  readonly code: ValidationCode;
  readonly path: readonly string[];
  readonly message: string;
}

export class ManifestValidationError extends Error {
  public readonly issues: readonly ValidationIssue[];

  public constructor(issues: readonly ValidationIssue[]) {
    super(issues.map((issue) => `${formatPath(issue.path)}: ${issue.message}`).join("\n"));
    this.name = "ManifestValidationError";
    this.issues = issues;
  }
}

export interface NewProjectConfig {
  readonly schemaVersion: 1;
  readonly project: {
    readonly name: string;
    readonly description: string;
    readonly slug: string;
    readonly directory: string;
  };
  readonly profile: ProjectProfile;
  readonly initialization: {
    readonly start: boolean;
    readonly git: false;
    readonly github: {
      readonly createPrivateRepository: false;
    };
  };
}

export type ProjectProfile = "essential" | "complete";

export interface ProjectServices {
  readonly redis: boolean;
  readonly storage: boolean;
  readonly email: boolean;
}

export interface ProjectManifest {
  readonly schemaVersion: 1;
  readonly project: {
    readonly name: string;
    readonly slug: string;
    readonly description: string;
  };
  readonly template: {
    readonly id: "next-fullstack";
    readonly version: "1.0.0";
  };
  readonly runtime: {
    readonly nodeMajor: 24;
    readonly packageManager: "npm";
  };
  readonly database: {
    readonly engine: "postgres";
    readonly majorVersion: 17;
    readonly orm: "prisma";
  };
  readonly profile: ProjectProfile;
  readonly services: ProjectServices;
  readonly capabilities: {
    readonly auth: "none";
  };
  readonly health: {
    readonly path: "/api/health";
  };
}

export interface TemplateLock {
  readonly schemaVersion: 1;
  readonly template: {
    readonly id: "next-fullstack";
    readonly version: "1.0.0";
  };
  readonly cliVersion: string;
}

export interface ParsedProjectManifest {
  readonly manifest: ProjectManifest;
  readonly warnings: readonly ValidationIssue[];
}

type UnknownRecord = Record<string, unknown>;

function formatPath(path: readonly string[]): string {
  return path.length === 0 ? "documento" : path.join(".");
}

function issue(code: ValidationCode, path: readonly string[], message: string): ValidationIssue {
  return { code, path, message };
}

function fail(issues: readonly ValidationIssue[]): never {
  throw new ManifestValidationError(issues);
}

function assertNoUnsafeCharacters(value: string, path: readonly string[]): string {
  const normalized = value.normalize("NFC");

  if (CONTROL_OR_BIDI.test(normalized)) {
    fail([issue("INVALID_VALUE", path, "não pode conter caracteres de controle ou bidi")]);
  }

  return normalized;
}

function asRecord(value: unknown, path: readonly string[]): UnknownRecord {
  if (value === undefined) {
    fail([issue("MISSING_FIELD", path, "é obrigatório")]);
  }

  if (value === null || Array.isArray(value) || typeof value !== "object") {
    fail([issue("INVALID_TYPE", path, "deve ser um objeto")]);
  }

  return value as UnknownRecord;
}

function stringField(
  record: UnknownRecord,
  key: string,
  path: readonly string[],
  minimum: number,
  maximum: number,
): string {
  const value = record[key];
  const fieldPath = [...path, key];

  if (typeof value !== "string") {
    fail([
      issue(value === undefined ? "MISSING_FIELD" : "INVALID_TYPE", fieldPath, "deve ser texto"),
    ]);
  }

  const normalized = assertNoUnsafeCharacters(value, fieldPath);
  if (normalized.length < minimum || normalized.length > maximum) {
    fail([issue("INVALID_VALUE", fieldPath, `deve ter entre ${minimum} e ${maximum} caracteres`)]);
  }

  return normalized;
}

function literalField<T extends string | number | boolean>(
  record: UnknownRecord,
  key: string,
  expected: T,
  path: readonly string[],
): T {
  const value = record[key];
  const fieldPath = [...path, key];

  if (value !== expected) {
    fail([
      issue(
        value === undefined ? "MISSING_FIELD" : "INVALID_VALUE",
        fieldPath,
        `deve ser ${JSON.stringify(expected)}`,
      ),
    ]);
  }

  return expected;
}

function booleanField(record: UnknownRecord, key: string, path: readonly string[]): boolean {
  const value = record[key];
  if (typeof value !== "boolean") {
    fail([
      issue(
        value === undefined ? "MISSING_FIELD" : "INVALID_TYPE",
        [...path, key],
        "deve ser booleano",
      ),
    ]);
  }
  return value;
}

function profileField(record: UnknownRecord, path: readonly string[]): ProjectProfile {
  const value = record.profile;
  if (value === "essential" || value === "complete") return value;
  fail([
    issue(
      value === undefined ? "MISSING_FIELD" : "INVALID_VALUE",
      [...path, "profile"],
      'deve ser "essential" ou "complete"',
    ),
  ]);
}

export function servicesForProfile(profile: ProjectProfile): ProjectServices {
  return profile === "complete"
    ? { redis: true, storage: true, email: true }
    : { redis: false, storage: false, email: false };
}

function parseServices(
  record: UnknownRecord,
  profile: ProjectProfile,
  path: readonly string[],
): ProjectServices {
  const expected = servicesForProfile(profile);
  const services: ProjectServices = {
    redis: booleanField(record, "redis", path),
    storage: booleanField(record, "storage", path),
    email: booleanField(record, "email", path),
  };
  for (const key of ["redis", "storage", "email"] as const) {
    if (services[key] !== expected[key]) {
      fail([
        issue(
          "INVALID_VALUE",
          [...path, key],
          `deve ser ${String(expected[key])} para o profile ${profile}`,
        ),
      ]);
    }
  }
  return services;
}

function checkKeys(
  record: UnknownRecord,
  allowed: readonly string[],
  path: readonly string[],
  unknownFields: "error" | "warning",
): ValidationIssue[] {
  const allowedKeys = new Set(allowed);
  const issues = Object.keys(record)
    .filter((key) => !allowedKeys.has(key))
    .map((key) => issue("UNKNOWN_FIELD", [...path, key], "campo desconhecido"));

  if (unknownFields === "error" && issues.length > 0) {
    fail(issues);
  }

  return issues;
}

function nodeToValue(node: Node | null, path: readonly string[], depth = 0): unknown {
  if (node === null) {
    return null;
  }

  if (depth > MAX_DEPTH) {
    fail([issue("INVALID_DOCUMENT", path, "excede a profundidade máxima")]);
  }

  if (isAlias(node)) {
    fail([issue("INVALID_DOCUMENT", path, "não permite aliases YAML")]);
  }

  if (node.tag?.startsWith("!")) {
    fail([issue("INVALID_DOCUMENT", path, "não permite tags YAML customizadas")]);
  }

  if (isScalar(node)) {
    return node.value;
  }

  if (isSeq(node)) {
    return node.items.map((item, index) =>
      nodeToValue(item as Node | null, [...path, String(index)], depth + 1),
    );
  }

  if (isMap(node)) {
    const result: UnknownRecord = Object.create(null) as UnknownRecord;
    const seenKeys = new Set<string>();

    for (const pair of node.items) {
      if (!isScalar(pair.key) || typeof pair.key.value !== "string") {
        fail([issue("INVALID_DOCUMENT", path, "exige chaves de texto simples")]);
      }

      const key = pair.key.value;
      if (key === "<<" || key === "__proto__" || key === "constructor" || key === "prototype") {
        fail([issue("INVALID_DOCUMENT", [...path, key], "chave não permitida")]);
      }

      if (seenKeys.has(key)) {
        fail([issue("INVALID_DOCUMENT", [...path, key], "chave duplicada")]);
      }

      seenKeys.add(key);
      result[key] = nodeToValue(pair.value as Node | null, [...path, key], depth + 1);
    }

    return result;
  }

  fail([issue("INVALID_DOCUMENT", path, "contém um nó YAML não permitido")]);
}

function parseYamlDocument(source: string): UnknownRecord {
  if (Buffer.byteLength(source, "utf8") > MAX_CONFIG_SIZE_BYTES) {
    fail([issue("INVALID_DOCUMENT", [], "excede o tamanho máximo permitido")]);
  }

  const documents = parseAllDocuments(source, {
    merge: false,
    prettyErrors: false,
    strict: true,
    uniqueKeys: true,
    version: "1.2",
  });

  if (documents.length !== 1) {
    fail([issue("INVALID_DOCUMENT", [], "deve conter exatamente um documento YAML")]);
  }

  const [document] = documents;
  if (document === undefined) {
    fail([issue("INVALID_DOCUMENT", [], "não contém documento YAML")]);
  }

  if (document.errors.length > 0 || document.warnings.length > 0) {
    const messages = [...document.errors, ...document.warnings]
      .map((error) => error.message.replace(/\s+at line.*$/u, ""))
      .join("; ");
    fail([issue("INVALID_DOCUMENT", [], `YAML inválido: ${messages}`)]);
  }

  return asRecord(nodeToValue(document.contents, []), []);
}

function parseSlug(value: string, path: readonly string[]): string {
  if (!SLUG_PATTERN.test(value) || RESERVED_SLUGS.has(value)) {
    fail([issue("INVALID_VALUE", path, "deve ser um slug ASCII minúsculo válido")]);
  }

  return value;
}

function parseProject(
  record: UnknownRecord,
  includeDirectory: boolean,
  unknownFields: "error" | "warning",
  warnings: ValidationIssue[],
): NewProjectConfig["project"] | ProjectManifest["project"] {
  const allowed = includeDirectory
    ? ["name", "description", "slug", "directory"]
    : ["name", "description", "slug"];
  warnings.push(...checkKeys(record, allowed, ["project"], unknownFields));

  const name = stringField(record, "name", ["project"], 1, 80);
  const description = stringField(record, "description", ["project"], 1, 280);
  const slug = parseSlug(stringField(record, "slug", ["project"], 1, 63), ["project", "slug"]);

  if (!includeDirectory) {
    return { name, description, slug };
  }

  const directory = stringField(record, "directory", ["project"], 1, 1_024);
  return { name, description, slug, directory };
}

export function parseNewProjectConfig(source: string): NewProjectConfig {
  const record = parseYamlDocument(source);
  checkKeys(record, ["schemaVersion", "project", "profile", "initialization"], [], "error");

  const project = parseProject(asRecord(record.project, ["project"]), true, "error", []);
  const initialization = asRecord(record.initialization, ["initialization"]);
  checkKeys(initialization, ["start", "git", "github"], ["initialization"], "error");
  const github = asRecord(initialization.github, ["initialization", "github"]);
  checkKeys(github, ["createPrivateRepository"], ["initialization", "github"], "error");

  return {
    schemaVersion: literalField(record, "schemaVersion", CONFIG_SCHEMA_VERSION, []),
    project: project as NewProjectConfig["project"],
    profile: profileField(record, []),
    initialization: {
      start: booleanField(initialization, "start", ["initialization"]),
      git: literalField(initialization, "git", false, ["initialization"]),
      github: {
        createPrivateRepository: literalField(github, "createPrivateRepository", false, [
          "initialization",
          "github",
        ]),
      },
    },
  };
}

export function createProjectManifest(config: NewProjectConfig): ProjectManifest {
  return {
    schemaVersion: CONFIG_SCHEMA_VERSION,
    project: {
      description: config.project.description,
      name: config.project.name,
      slug: config.project.slug,
    },
    template: { id: "next-fullstack", version: "1.0.0" },
    runtime: { nodeMajor: 24, packageManager: "npm" },
    database: { engine: "postgres", majorVersion: 17, orm: "prisma" },
    profile: config.profile,
    services: servicesForProfile(config.profile),
    capabilities: { auth: "none" },
    health: { path: "/api/health" },
  };
}

function parseProjectManifestInternal(
  source: string,
  unknownFields: "error" | "warning",
): ParsedProjectManifest {
  const record = parseYamlDocument(source);
  const warnings = checkKeys(
    record,
    [
      "schemaVersion",
      "project",
      "template",
      "runtime",
      "database",
      "profile",
      "services",
      "capabilities",
      "health",
    ],
    [],
    unknownFields,
  );
  const project = parseProject(
    asRecord(record.project, ["project"]),
    false,
    unknownFields,
    warnings,
  ) as ProjectManifest["project"];
  const template = asRecord(record.template, ["template"]);
  const runtime = asRecord(record.runtime, ["runtime"]);
  const database = asRecord(record.database, ["database"]);
  const services = asRecord(record.services, ["services"]);
  const capabilities = asRecord(record.capabilities, ["capabilities"]);
  const health = asRecord(record.health, ["health"]);

  warnings.push(
    ...checkKeys(template, ["id", "version"], ["template"], unknownFields),
    ...checkKeys(runtime, ["nodeMajor", "packageManager"], ["runtime"], unknownFields),
    ...checkKeys(database, ["engine", "majorVersion", "orm"], ["database"], unknownFields),
    ...checkKeys(services, ["redis", "storage", "email"], ["services"], unknownFields),
    ...checkKeys(capabilities, ["auth"], ["capabilities"], unknownFields),
    ...checkKeys(health, ["path"], ["health"], unknownFields),
  );

  const profile = profileField(record, []);
  return {
    warnings,
    manifest: {
      schemaVersion: literalField(record, "schemaVersion", CONFIG_SCHEMA_VERSION, []),
      project,
      template: {
        id: literalField(template, "id", "next-fullstack", ["template"]),
        version: literalField(template, "version", "1.0.0", ["template"]),
      },
      runtime: {
        nodeMajor: literalField(runtime, "nodeMajor", 24, ["runtime"]),
        packageManager: literalField(runtime, "packageManager", "npm", ["runtime"]),
      },
      database: {
        engine: literalField(database, "engine", "postgres", ["database"]),
        majorVersion: literalField(database, "majorVersion", 17, ["database"]),
        orm: literalField(database, "orm", "prisma", ["database"]),
      },
      profile,
      services: parseServices(services, profile, ["services"]),
      capabilities: {
        auth: literalField(capabilities, "auth", "none", ["capabilities"]),
      },
      health: {
        path: literalField(health, "path", "/api/health", ["health"]),
      },
    },
  };
}

export function parseProjectManifest(source: string): ParsedProjectManifest {
  return parseProjectManifestInternal(source, "warning");
}

export function parseGeneratedProjectManifest(source: string): ProjectManifest {
  return parseProjectManifestInternal(source, "error").manifest;
}
