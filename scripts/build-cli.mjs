import { build } from "esbuild";
import { mkdir, readFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const packagePath = new URL("../packages/cli/package.json", import.meta.url);
const outputDirectory = new URL("../packages/cli/dist/", import.meta.url);
const outputFile = new URL("main.js", outputDirectory);
const packageMetadata = JSON.parse(await readFile(packagePath, "utf8"));

if (typeof packageMetadata.version !== "string") {
  throw new Error("A versão do pacote CLI é inválida.");
}

await rm(outputDirectory, { force: true, recursive: true });
await mkdir(outputDirectory, { recursive: true });

await build({
  banner: { js: "#!/usr/bin/env node" },
  bundle: true,
  define: { "process.env.ZERO_VERSION": JSON.stringify(packageMetadata.version) },
  entryPoints: [fileURLToPath(new URL("../packages/cli/src/bin.ts", import.meta.url))],
  format: "esm",
  outfile: fileURLToPath(outputFile),
  platform: "node",
  target: "node24",
});
