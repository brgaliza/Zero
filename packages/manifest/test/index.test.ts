import { readFile } from "node:fs/promises";

import { Ajv2020 } from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";

import {
  createProjectManifest,
  ManifestValidationError,
  parseNewProjectConfig,
  parseGeneratedProjectManifest,
  parseProjectManifest,
} from "../src/index.js";

const validConfig = `schemaVersion: 1
project:
  name: Minha Agenda
  description: Uma agenda pessoal
  slug: minha-agenda
  directory: ~/Projetos/minha-agenda
profile: essential
initialization:
  start: false
  git: false
  github:
    createPrivateRepository: false
`;
const completeConfig = validConfig.replace("profile: essential", "profile: complete");

describe("parseNewProjectConfig", () => {
  it("aceita o contrato transitório da Sprint 1", () => {
    expect(parseNewProjectConfig(validConfig)).toMatchObject({
      profile: "essential",
      project: { slug: "minha-agenda" },
    });
  });

  it("rejeita campo desconhecido antes de qualquer operação externa", () => {
    expect(() => parseNewProjectConfig(`${validConfig}unknown: true\n`)).toThrow(
      ManifestValidationError,
    );
  });

  it("aceita início explícito do ambiente na Sprint 2", () => {
    expect(parseNewProjectConfig(validConfig.replace("start: false", "start: true"))).toMatchObject(
      {
        initialization: { start: true },
      },
    );
  });

  it("aceita o perfil complete", () => {
    expect(parseNewProjectConfig(completeConfig)).toMatchObject({ profile: "complete" });
  });

  it("rejeita profile desconhecido", () => {
    expect(() => parseNewProjectConfig(validConfig.replace("essential", "redis"))).toThrow(
      ManifestValidationError,
    );
  });

  it.each([
    "---\nfoo: bar\n---\nfoo: baz\n",
    "base: &shared\n  name: Teste\nproject: *shared\n",
    "project:\n  name: um\n  name: dois\n",
    "__proto__: valor\n",
  ])("rejeita YAML inseguro: %s", (source) => {
    expect(() => parseNewProjectConfig(source)).toThrow(ManifestValidationError);
  });

  it("rejeita caracteres de controle em campos de usuário", () => {
    expect(() =>
      parseNewProjectConfig(validConfig.replace("Minha Agenda", "Minha\u001b Agenda")),
    ).toThrow(ManifestValidationError);
  });
});

describe("manifesto do projeto", () => {
  it("deriva um manifesto portátil sem diretório local", () => {
    const manifest = createProjectManifest(parseNewProjectConfig(validConfig));

    expect(manifest).toMatchObject({
      database: { majorVersion: 17 },
      runtime: { nodeMajor: 24 },
      services: { email: false, redis: false, storage: false },
    });
    expect(manifest.project).not.toHaveProperty("directory");
  });

  it("deriva todos os serviços apenas para complete", () => {
    expect(createProjectManifest(parseNewProjectConfig(completeConfig))).toMatchObject({
      profile: "complete",
      services: { email: true, redis: true, storage: true },
    });
  });

  it("rejeita serviços inconsistentes com o profile", () => {
    const manifest = createProjectManifest(parseNewProjectConfig(completeConfig));
    expect(() =>
      parseGeneratedProjectManifest(
        JSON.stringify({ ...manifest, services: { ...manifest.services, redis: false } }),
      ),
    ).toThrow(ManifestValidationError);
  });

  it("avisa sobre campos futuros no manifesto existente", () => {
    const manifest = `schemaVersion: 1
project:
  name: Minha Agenda
  description: Uma agenda pessoal
  slug: minha-agenda
  locale: pt-BR
template:
  id: next-fullstack
  version: 1.0.0
runtime:
  nodeMajor: 24
  packageManager: npm
database:
  engine: postgres
  majorVersion: 17
  orm: prisma
profile: essential
services:
  redis: false
  storage: false
  email: false
  vectorDb: true
capabilities:
  auth: none
health:
  path: /api/health
futureFeature: enabled
`;

    const result = parseProjectManifest(manifest);

    expect(result.warnings).toEqual([
      expect.objectContaining({ code: "UNKNOWN_FIELD", path: ["futureFeature"] }),
      expect.objectContaining({ code: "UNKNOWN_FIELD", path: ["project", "locale"] }),
      expect.objectContaining({ code: "UNKNOWN_FIELD", path: ["services", "vectorDb"] }),
    ]);
  });

  it("rejeita campos futuros ao validar manifesto recém-gerado estritamente", () => {
    const manifest = createProjectManifest(parseNewProjectConfig(validConfig));
    const source = JSON.stringify({
      ...manifest,
      services: { ...manifest.services, vectorDb: true },
    });

    expect(() => parseGeneratedProjectManifest(source)).toThrow(ManifestValidationError);
  });
});

describe("schemas portáveis", () => {
  it.each([
    "../../../schemas/new-project-config.v1.schema.json",
    "../../../schemas/project-manifest.v1.schema.json",
    "../../../schemas/template-lock.v1.schema.json",
  ])("é JSON Schema versionado: %s", async (relativePath) => {
    const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
    const schema = JSON.parse(source);

    expect(schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
    expect(schema.properties.schemaVersion.const).toBe(1);
  });

  it("rejeita extensões no schema canônico de manifesto", async () => {
    const source = await readFile(
      new URL("../../../schemas/project-manifest.v1.schema.json", import.meta.url),
      "utf8",
    );
    const validate = new Ajv2020().compile(JSON.parse(source));
    const manifest = createProjectManifest(parseNewProjectConfig(validConfig));

    expect(validate({ ...manifest, services: { ...manifest.services, vectorDb: true } })).toBe(
      false,
    );
  });

  it("impõe o conjunto de serviços no schema canônico", async () => {
    const source = await readFile(
      new URL("../../../schemas/project-manifest.v1.schema.json", import.meta.url),
      "utf8",
    );
    const validate = new Ajv2020().compile(JSON.parse(source));
    const manifest = createProjectManifest(parseNewProjectConfig(completeConfig));

    expect(validate(manifest)).toBe(true);
    expect(validate({ ...manifest, services: { ...manifest.services, email: false } })).toBe(false);
  });
});
