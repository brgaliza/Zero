import { spawnSync } from "node:child_process";
import { readFile, realpath } from "node:fs/promises";
import { resolve } from "node:path";

import { assertLocalProjectOwnership } from "../../core/src/index.js";
import { parseProjectManifest } from "../../manifest/src/index.js";
import { runIsolatedE2e } from "./e2e.js";

export interface TestResult {
  readonly ok: boolean;
  readonly exitCode: number;
  readonly code: string;
  readonly message: string;
}

export async function runTest(e2e: boolean, currentDirectory = process.cwd()): Promise<TestResult> {
  try {
    const directory = await realpath(currentDirectory);
    parseProjectManifest(await readFile(resolve(directory, "zero.yaml"), "utf8"));
    await assertLocalProjectOwnership(directory);
    const result = spawnSync("npm", ["run", "check"], {
      cwd: directory,
      encoding: "utf8",
      env: { LANG: process.env.LANG ?? "pt_BR.UTF-8", PATH: process.env.PATH ?? "" },
      shell: false,
    });
    if (result.status !== 0) throw new Error("A validação rápida falhou.");
    if (e2e) await runIsolatedE2e(directory);
    return { ok: true, exitCode: 0, code: "TESTS_PASSED", message: "Validação rápida concluída." };
  } catch {
    return { ok: false, exitCode: 4, code: "TESTS_FAILED", message: "A validação rápida falhou." };
  }
}
