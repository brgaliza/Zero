import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { createProjectManifest, parseGeneratedProjectManifest } from "../../manifest/src/index.js";
import { renderEssentialProjectFiles } from "../src/index.js";

const templateDirectory = new URL("../../../templates/next-fullstack/essential/", import.meta.url);

async function readTemplateFile(path: string): Promise<string> {
  return readFile(new URL(path, templateDirectory), "utf8");
}

describe("template next-fullstack/essential", () => {
  it("declara o contrato canônico sem serviços opcionais ou autenticação", async () => {
    const manifest = parseGeneratedProjectManifest(await readTemplateFile("zero.yaml"));

    expect(manifest).toMatchObject({
      schemaVersion: 1,
      template: { id: "next-fullstack", version: "1.0.0" },
      runtime: { nodeMajor: 24, packageManager: "npm" },
      database: { engine: "postgres", majorVersion: 17, orm: "prisma" },
      profile: "essential",
      services: { redis: false, storage: false, email: false },
      capabilities: { auth: "none" },
      health: { path: "/api/health" },
    });
  });

  it("fixa dependências e proveniência sem valores sensíveis", async () => {
    const packageMetadata = JSON.parse(await readTemplateFile("package.json")) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
      engines: Record<string, string>;
    };
    const lock = JSON.parse(await readTemplateFile("package-lock.json")) as {
      lockfileVersion: number;
      packages: Record<string, unknown>;
    };
    const templateLock = JSON.parse(await readTemplateFile(".zero/template.lock.json")) as {
      schemaVersion: number;
      template: { id: string; version: string };
      cliVersion: string;
    };
    const environmentExample = await readTemplateFile(".env.example");

    expect(packageMetadata.engines.node).toBe(">=24");
    expect(packageMetadata.dependencies).toMatchObject({
      next: "16.3.3",
      "@prisma/client": "6.12.0",
    });
    expect(packageMetadata.devDependencies.prisma).toBe("6.12.0");
    expect(lock.lockfileVersion).toBe(3);
    expect(lock.packages[""]).toBeDefined();
    expect(templateLock).toEqual({
      schemaVersion: 1,
      template: { id: "next-fullstack", version: "1.0.0" },
      cliVersion: "0.1.0",
    });
    expect(environmentExample).toContain("DATABASE_URL=");
    expect(environmentExample).not.toMatch(/postgres:postgres|password=|secret=/iu);
  });

  it("explica em português que o scaffold ainda não executa o ambiente", async () => {
    const documents = await Promise.all(
      ["README.md", "AGENTS.md", "CLAUDE.md"].map((path) => readTemplateFile(path)),
    );

    expect(documents.join("\n")).toContain("pré-execução");
    expect(documents.join("\n")).toContain("Sprint 1");
    expect(documents.join("\n")).toMatch(/nenhum processo está em\s+execução/u);
  });

  it("mantém o arquivo de transporte do tarball igual ao .gitignore final", async () => {
    expect(await readTemplateFile("gitignore")).toBe(await readTemplateFile(".gitignore"));
  });

  it("renderiza o contexto escolhido com serialização específica por formato", async () => {
    const manifest = createProjectManifest({
      schemaVersion: 1,
      project: {
        name: 'Café "Nova"',
        slug: "cafe-nova",
        description: "Uma ideia [segura] para testar contexto.",
        directory: "cafe-nova",
      },
      profile: "essential",
      initialization: {
        start: false,
        git: false,
        github: { createPrivateRepository: false },
      },
    });
    const files = renderEssentialProjectFiles({
      manifest,
      templateLock: JSON.parse(await readTemplateFile(".zero/template.lock.json")),
      packageLock: await readTemplateFile("package-lock.json"),
    });
    const contentsFor = (path: string): string => {
      const file = files.find((candidate) => candidate.path === path);
      if (file === undefined || typeof file.contents !== "string") {
        throw new Error(`Arquivo renderizado ausente: ${path}`);
      }
      return file.contents;
    };

    expect(parseGeneratedProjectManifest(contentsFor("zero.yaml")).project).toEqual(
      manifest.project,
    );
    expect(JSON.parse(contentsFor("package.json"))).toMatchObject({ name: "cafe-nova" });
    expect(JSON.parse(contentsFor("package-lock.json"))).toMatchObject({
      name: "cafe-nova",
      packages: { "": { name: "cafe-nova" } },
    });
    expect(contentsFor("README.md")).toContain('Café "Nova"');
    expect(contentsFor("app/layout.tsx")).toContain(JSON.stringify(manifest.project.name));
    expect(contentsFor("app/page.tsx")).toContain(JSON.stringify(manifest.project.description));
  });
});
