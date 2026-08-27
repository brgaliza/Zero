import { build } from "esbuild";
import { cp, mkdir, readFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const packagePath = new URL("../packages/cli/package.json", import.meta.url);
const outputDirectory = new URL("../packages/cli/dist/", import.meta.url);
const outputFile = new URL("main.js", outputDirectory);
const obsoleteScaffoldOutputDirectory = new URL("../packages/scaffold/dist/", import.meta.url);
const scaffoldOutputFile = new URL("scaffold.cjs", outputDirectory);
const templateSourceDirectory = new URL("../templates/", import.meta.url);
const templateOutputDirectory = new URL("../packages/cli/templates/", import.meta.url);
const schemaSourceDirectory = new URL("../schemas/", import.meta.url);
const schemaOutputDirectory = new URL("../packages/cli/schemas/", import.meta.url);
const packageMetadata = JSON.parse(await readFile(packagePath, "utf8"));

if (typeof packageMetadata.version !== "string") {
  throw new Error("A versão do pacote CLI é inválida.");
}

await rm(outputDirectory, { force: true, recursive: true });
await rm(obsoleteScaffoldOutputDirectory, { force: true, recursive: true });
await rm(templateOutputDirectory, { force: true, recursive: true });
await rm(schemaOutputDirectory, { force: true, recursive: true });
await mkdir(outputDirectory, { recursive: true });
await cp(templateSourceDirectory, templateOutputDirectory, { recursive: true });
await cp(schemaSourceDirectory, schemaOutputDirectory, { recursive: true });

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

await build({
  bundle: true,
  entryPoints: [fileURLToPath(new URL("../packages/scaffold/src/index.ts", import.meta.url))],
  format: "cjs",
  outfile: fileURLToPath(scaffoldOutputFile),
  platform: "node",
  target: "node24",
});
