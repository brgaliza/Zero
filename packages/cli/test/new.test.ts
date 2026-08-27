import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { runDeclarative, runGuided, type NewRuntime } from "../src/new.js";

const temporaryDirectories: string[] = [];
const templateDirectory = new URL("../../../templates/next-fullstack/essential/", import.meta.url)
  .pathname;
const config =
  "schemaVersion: 1\nproject:\n  name: Minha Agenda\n  description: Uma agenda pessoal\n  slug: minha-agenda\n  directory: projeto\nprofile: essential\ninitialization:\n  start: false\n  git: false\n  github:\n    createPrivateRepository: false\n";

async function runtime(): Promise<NewRuntime> {
  const directory = await mkdtemp(join(tmpdir(), "zero-cli-new-"));
  temporaryDirectories.push(directory);
  return {
    nodeVersion: "v24.0.0",
    npmVersion: "11.0.0",
    currentDirectory: directory,
    templateDirectory,
    isInteractive: true,
    prompt: vi.fn(),
    readConfig: async () => config,
  };
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe("zero new", () => {
  it("cria a mesma fundação pelo arquivo declarativo", async () => {
    const input = await runtime();
    const result = await runDeclarative("config.yaml", true, input);

    expect(result).toMatchObject({ ok: true, exitCode: 0, code: "PROJECT_CREATED" });
    await expect(
      readFile(join(input.currentDirectory, "projeto", "zero.yaml"), "utf8"),
    ).resolves.toContain("minha-agenda");
  });

  it("rejeita --config sem --yes antes de ler ou escrever", async () => {
    const input = await runtime();
    const readConfig = vi.fn(input.readConfig);
    const result = await runDeclarative("config.yaml", false, { ...input, readConfig });

    expect(result).toMatchObject({ exitCode: 2, code: "INVALID_ARGUMENTS" });
    expect(readConfig).not.toHaveBeenCalled();
  });

  it("mantém stdout JSON puro quando o modo declarativo retorna erro", async () => {
    const input = await runtime();
    const result = await runDeclarative("config.yaml", true, {
      ...input,
      readConfig: async () => "schemaVersion: 1\n",
    });

    expect(result).toMatchObject({ exitCode: 2, code: "CONFIG_INVALID" });
  });

  it("cancela o assistente antes de materializar", async () => {
    const input = await runtime();
    const answers = ["Minha Agenda", "Uma agenda pessoal", "", "projeto", "n"];
    const result = await runGuided({ ...input, prompt: async () => answers.shift() ?? "" });

    expect(result).toMatchObject({ exitCode: 2, code: "CANCELLED" });
    await expect(
      readFile(join(input.currentDirectory, "projeto", "zero.yaml"), "utf8"),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });
});
