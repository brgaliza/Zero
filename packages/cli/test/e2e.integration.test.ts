import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { runIsolatedE2e } from "../src/e2e.js";
import { runBuild } from "../src/build.js";
import { runDeclarative, type NewRuntime } from "../src/new.js";

const enabled = process.env.RUN_DOCKER_E2E === "1";
const directories: string[] = [];
const templateDirectory = new URL("../../../templates/next-fullstack/essential/", import.meta.url)
  .pathname;

afterEach(async () =>
  Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  ),
);

describe.skipIf(!enabled)("gauntlet Docker", () => {
  for (const profile of ["essential", "complete"] as const) {
    it(`${profile} valida uma pilha sem tocar em projeto persistente`, async () => {
      const root = await mkdtemp(join(tmpdir(), `zero-e2e-${profile}-`));
      directories.push(root);
      const config = `schemaVersion: 1\nproject:\n  name: E2E ${profile}\n  description: Fixture isolada\n  slug: e2e-${profile}\n  directory: projeto\nprofile: ${profile}\ninitialization:\n  start: false\n  git: false\n  github:\n    createPrivateRepository: false\n`;
      const runtime: NewRuntime = {
        nodeVersion: "v24.0.0",
        npmVersion: "11.0.0",
        currentDirectory: root,
        templateDirectory,
        isInteractive: false,
        prompt: async () => "",
        readConfig: async () => config,
      };
      const created = await runDeclarative("config.yaml", true, runtime);
      expect(created.ok).toBe(true);
      const project = join(root, "projeto");
      expect(
        spawnSync("npm", ["ci", "--ignore-scripts"], {
          cwd: project,
          shell: false,
          stdio: "inherit",
          timeout: 180_000,
        }).status,
      ).toBe(0);
      if (process.env.RUN_BUILD_SMOKE === "1") {
        await expect(runBuild(project)).resolves.toMatchObject({ ok: true });
      } else {
        await expect(runIsolatedE2e(project)).resolves.toBeUndefined();
      }
    }, 300_000);
  }
});
