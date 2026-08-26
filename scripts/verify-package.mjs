import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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

  const expectedFiles = new Set(["dist/main.js", "package.json"]);
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
} finally {
  rmSync(temporaryDirectory, { force: true, recursive: true });
}
