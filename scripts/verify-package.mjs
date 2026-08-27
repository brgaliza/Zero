import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const rootDirectory = process.cwd();
const temporaryDirectory = mkdtempSync(join(tmpdir(), "zero-package-"));

try {
  execFileSync(
    "npm",
    ["publish", "--workspace=@brunogaliza/zero", "--dry-run", "--ignore-scripts"],
    { cwd: rootDirectory, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );

  const packed = JSON.parse(
    execFileSync(
      "npm",
      [
        "pack",
        "--workspace=@brunogaliza/zero",
        `--pack-destination=${temporaryDirectory}`,
        "--json",
        "--ignore-scripts",
      ],
      { cwd: rootDirectory, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    ),
  );

  const [artifact] = packed;
  if (typeof artifact?.filename !== "string") {
    throw new Error("npm pack não retornou o artefato esperado.");
  }

  const expectedFiles = new Set([
    "dist/main.js",
    "dist/scaffold.cjs",
    "package.json",
    "schemas/new-project-config.v1.schema.json",
    "schemas/project-manifest.v1.schema.json",
    "schemas/template-lock.v1.schema.json",
    "templates/next-fullstack/essential/.env.example",
    "templates/next-fullstack/essential/.zero/template.lock.json",
    "templates/next-fullstack/essential/AGENTS.md",
    "templates/next-fullstack/essential/CLAUDE.md",
    "templates/next-fullstack/essential/README.md",
    "templates/next-fullstack/essential/app/api/health/route.ts",
    "templates/next-fullstack/essential/app/globals.css",
    "templates/next-fullstack/essential/app/layout.tsx",
    "templates/next-fullstack/essential/app/page.tsx",
    "templates/next-fullstack/essential/gitignore",
    "templates/next-fullstack/essential/next-env.d.ts",
    "templates/next-fullstack/essential/package-lock.json",
    "templates/next-fullstack/essential/package.json",
    "templates/next-fullstack/essential/prisma/schema.prisma",
    "templates/next-fullstack/essential/tsconfig.json",
    "templates/next-fullstack/essential/zero.yaml",
  ]);
  const packedFiles = artifact.files;

  if (!Array.isArray(packedFiles) || packedFiles.length !== expectedFiles.size) {
    throw new Error("O artefato contém um inventário de arquivos inesperado.");
  }

  for (const file of packedFiles) {
    if (typeof file?.path !== "string" || !expectedFiles.has(file.path) || file.mode !== 0o644) {
      throw new Error("O artefato contém arquivo ou permissões não permitidos.");
    }
  }

  const artifactPath = join(temporaryDirectory, artifact.filename);
  const installationDirectory = join(temporaryDirectory, "installation");

  mkdirSync(installationDirectory, { mode: 0o700 });

  execFileSync("npm", ["install", "--ignore-scripts", "--no-package-lock", artifactPath], {
    cwd: installationDirectory,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  const packageMetadata = JSON.parse(
    readFileSync(
      join(installationDirectory, "node_modules", "@brunogaliza", "zero", "package.json"),
      "utf8",
    ),
  );

  if (packageMetadata.dependencies !== undefined || packageMetadata.scripts !== undefined) {
    throw new Error("O pacote publicado não pode declarar dependencies ou scripts.");
  }

  if (
    packageMetadata.private !== false ||
    packageMetadata.publishConfig?.access !== "restricted" ||
    packageMetadata.publishConfig?.registry !== "https://registry.npmjs.org"
  ) {
    throw new Error("O pacote publicado deve usar exclusivamente publicação npm restrita.");
  }

  const helpOutput = execFileSync(
    "node",
    [join(installationDirectory, "node_modules", ".bin", "zero"), "--help"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );

  if (!helpOutput.includes("Zero — fundador guiado")) {
    throw new Error("O bin instalado não exibiu a ajuda esperada.");
  }

  const versionOutput = execFileSync(
    "node",
    [join(installationDirectory, "node_modules", ".bin", "zero"), "--version"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  ).trim();

  if (versionOutput !== packageMetadata.version) {
    throw new Error("O bin instalado não expôs a versão do package.json.");
  }

  const installedPackageDirectory = join(
    installationDirectory,
    "node_modules",
    "@brunogaliza",
    "zero",
  );
  const installedTemplateDirectory = join(
    installedPackageDirectory,
    "templates",
    "next-fullstack",
    "essential",
  );
  const staticTemplateFiles = [];
  for (const templateFile of expectedFiles) {
    if (!templateFile.startsWith("templates/")) {
      continue;
    }
    const sourceFile = join(rootDirectory, templateFile);
    const installedFile = join(
      installationDirectory,
      "node_modules",
      "@brunogaliza",
      "zero",
      templateFile,
    );
    if (readFileSync(sourceFile, "utf8") !== readFileSync(installedFile, "utf8")) {
      throw new Error(`O template no tarball diverge do checkout: ${templateFile}`);
    }
    const templatePath = templateFile.replace("templates/next-fullstack/essential/", "");
    staticTemplateFiles.push({
      path: templatePath === "gitignore" ? ".gitignore" : templatePath,
      contents: readFileSync(installedFile, "utf8"),
    });
  }

  const { materializeTemplate, renderEssentialProjectFiles, resolveProjectDestination } =
    await import(pathToFileURL(join(installedPackageDirectory, "dist", "scaffold.cjs")).href);
  const fixtureParent = join(temporaryDirectory, "materialized-template");
  mkdirSync(fixtureParent, { mode: 0o700 });
  const manifest = {
    schemaVersion: 1,
    project: {
      name: "Projeto de validação",
      slug: "projeto-validacao",
      description: "Fixture materializada a partir do tarball do Zero.",
    },
    template: { id: "next-fullstack", version: "1.0.0" },
    runtime: { nodeMajor: 24, packageManager: "npm" },
    database: { engine: "postgres", majorVersion: 17, orm: "prisma" },
    profile: "essential",
    services: { redis: false, storage: false, email: false },
    capabilities: { auth: "none" },
    health: { path: "/api/health" },
  };
  const dynamicTemplateFiles = renderEssentialProjectFiles({
    manifest,
    templateLock: JSON.parse(
      readFileSync(join(installedTemplateDirectory, ".zero", "template.lock.json"), "utf8"),
    ),
    packageLock: readFileSync(join(installedTemplateDirectory, "package-lock.json"), "utf8"),
  });
  const filesByPath = new Map(staticTemplateFiles.map((file) => [file.path, file]));
  for (const file of dynamicTemplateFiles) {
    filesByPath.set(file.path, file);
  }
  const fixtureDestination = await resolveProjectDestination({
    configurationDirectory: fixtureParent,
    directory: "projeto-validacao",
  });
  await materializeTemplate(fixtureDestination, [...filesByPath.values()]);

  for (const requiredFile of [".gitignore", "zero.yaml", ".zero/template.lock.json", "README.md"]) {
    readFileSync(join(fixtureDestination.directory, requiredFile), "utf8");
  }
  if (
    !readFileSync(join(fixtureDestination.directory, "zero.yaml"), "utf8").includes(
      "projeto-validacao",
    )
  ) {
    throw new Error("A fixture materializada não recebeu o manifesto contextual esperado.");
  }

  execFileSync("npm", ["ci", "--ignore-scripts", "--no-audit", "--no-fund"], {
    cwd: fixtureDestination.directory,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  execFileSync("npm", ["audit", "--package-lock-only", "--ignore-scripts", "--audit-level=high"], {
    cwd: fixtureDestination.directory,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
} finally {
  rmSync(temporaryDirectory, { force: true, recursive: true });
}
