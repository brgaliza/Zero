import { build } from "esbuild";
import { cp, mkdir, readFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const packagePath = new URL("../packages/cli/package.json", import.meta.url);
const outputDirectory = new URL("../packages/cli/dist/", import.meta.url);
const outputFile = new URL("main.js", outputDirectory);
const obsoleteScaffoldOutputDirectory = new URL("../packages/scaffold/dist/", import.meta.url);
const scaffoldOutputFile = new URL("scaffold.cjs", outputDirectory);
const newOutputFile = new URL("new.cjs", outputDirectory);
const doctorOutputFile = new URL("doctor.cjs", outputDirectory);
const upOutputFile = new URL("up.cjs", outputDirectory);
const downOutputFile = new URL("down.cjs", outputDirectory);
const statusOutputFile = new URL("status.cjs", outputDirectory);
const logsOutputFile = new URL("logs.cjs", outputDirectory);
const testOutputFile = new URL("test.cjs", outputDirectory);
const buildOutputFile = new URL("build.cjs", outputDirectory);
const recoverOutputFile = new URL("recover.cjs", outputDirectory);
const reportOutputFile = new URL("report.cjs", outputDirectory);
const rollbackOutputFile = new URL("rollback.cjs", outputDirectory);
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
  external: [
    "./build.cjs",
    "./doctor.cjs",
    "./down.cjs",
    "./logs.cjs",
    "./new.cjs",
    "./recover.cjs",
    "./report.cjs",
    "./rollback.cjs",
    "./status.cjs",
    "./test.cjs",
    "./up.cjs",
  ],
});

await build({
  bundle: true,
  entryPoints: [fileURLToPath(new URL("../packages/cli/src/rollback.ts", import.meta.url))],
  format: "cjs",
  outfile: fileURLToPath(rollbackOutputFile),
  platform: "node",
  target: "node24",
});

await build({
  bundle: true,
  entryPoints: [fileURLToPath(new URL("../packages/cli/src/report.ts", import.meta.url))],
  format: "cjs",
  outfile: fileURLToPath(reportOutputFile),
  platform: "node",
  target: "node24",
});

await build({
  bundle: true,
  entryPoints: [fileURLToPath(new URL("../packages/cli/src/recover.ts", import.meta.url))],
  format: "cjs",
  outfile: fileURLToPath(recoverOutputFile),
  platform: "node",
  target: "node24",
});

await build({
  bundle: true,
  entryPoints: [fileURLToPath(new URL("../packages/cli/src/test.ts", import.meta.url))],
  format: "cjs",
  outfile: fileURLToPath(testOutputFile),
  platform: "node",
  target: "node24",
});

await build({
  bundle: true,
  entryPoints: [fileURLToPath(new URL("../packages/cli/src/build.ts", import.meta.url))],
  format: "cjs",
  outfile: fileURLToPath(buildOutputFile),
  platform: "node",
  target: "node24",
});

await build({
  bundle: true,
  entryPoints: [fileURLToPath(new URL("../packages/cli/src/doctor.ts", import.meta.url))],
  format: "cjs",
  outfile: fileURLToPath(doctorOutputFile),
  platform: "node",
  target: "node24",
});

await build({
  bundle: true,
  entryPoints: [fileURLToPath(new URL("../packages/cli/src/logs.ts", import.meta.url))],
  format: "cjs",
  outfile: fileURLToPath(logsOutputFile),
  platform: "node",
  target: "node24",
});

await build({
  bundle: true,
  entryPoints: [fileURLToPath(new URL("../packages/cli/src/status.ts", import.meta.url))],
  format: "cjs",
  outfile: fileURLToPath(statusOutputFile),
  platform: "node",
  target: "node24",
});

await build({
  bundle: true,
  entryPoints: [fileURLToPath(new URL("../packages/cli/src/down.ts", import.meta.url))],
  format: "cjs",
  outfile: fileURLToPath(downOutputFile),
  platform: "node",
  target: "node24",
});

await build({
  bundle: true,
  entryPoints: [fileURLToPath(new URL("../packages/cli/src/up.ts", import.meta.url))],
  format: "cjs",
  outfile: fileURLToPath(upOutputFile),
  platform: "node",
  target: "node24",
});

await build({
  bundle: true,
  entryPoints: [fileURLToPath(new URL("../packages/cli/src/new.ts", import.meta.url))],
  format: "cjs",
  outfile: fileURLToPath(newOutputFile),
  platform: "node",
  target: "node24",
  external: ["./up.cjs"],
});

await build({
  bundle: true,
  entryPoints: [fileURLToPath(new URL("../packages/scaffold/src/index.ts", import.meta.url))],
  format: "cjs",
  outfile: fileURLToPath(scaffoldOutputFile),
  platform: "node",
  target: "node24",
});
