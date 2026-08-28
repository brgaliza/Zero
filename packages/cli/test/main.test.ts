import { describe, expect, it, vi } from "vitest";

import { run } from "../src/main.js";

describe("run", () => {
  it("exibe ajuda sem argumentos", async () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    expect(await run([])).toBe(0);
    expect(write).toHaveBeenCalledWith(expect.stringContaining("Zero — fundador guiado"));

    write.mockRestore();
  });

  it("exibe a versão", async () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const previousVersion = process.env.ZERO_VERSION;

    try {
      process.env.ZERO_VERSION = "0.1.0";

      expect(await run(["--version"])).toBe(0);
      expect(write).toHaveBeenCalledWith("0.1.0\n");
    } finally {
      if (previousVersion === undefined) {
        delete process.env.ZERO_VERSION;
      } else {
        process.env.ZERO_VERSION = previousVersion;
      }

      write.mockRestore();
    }
  });

  it("diagnostica setup sem alterar a máquina e permite JSON puro", async () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const probe = vi.fn((command: "npm" | "docker" | "git" | "gh") => {
      return command === "npm"
        ? { kind: "detected" as const, version: "11.17.0" }
        : { kind: "missing" as const };
    });

    expect(await run(["setup", "--json"], { nodeVersion: "v24.4.0", probe })).toBe(0);
    const output = write.mock.calls[0]?.[0];
    expect(typeof output).toBe("string");
    const parsed = JSON.parse(output as string) as {
      ok: boolean;
      command: string;
      checks: Array<{ id: string; state: string }>;
    };
    expect(parsed.ok).toBe(true);
    expect(parsed.command).toBe("setup");
    expect(parsed.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "node", state: "ready" }),
        expect.objectContaining({ id: "npm", state: "ready" }),
        expect.objectContaining({ id: "docker", state: "blocked" }),
      ]),
    );
    expect(probe).toHaveBeenCalledWith("npm");
    write.mockRestore();
  });

  it("aceita Node.js 26 e mantém Node.js 23 como bloqueador", async () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const probe = vi.fn(() => ({ kind: "detected" as const, version: "11.17.0" }));

    expect(await run(["setup", "--json"], { nodeVersion: "v26.5.0", probe })).toBe(0);
    expect(JSON.parse(write.mock.calls[0]?.[0] as string)).toMatchObject({
      checks: expect.arrayContaining([expect.objectContaining({ id: "node", state: "ready" })]),
    });

    expect(await run(["setup", "--json"], { nodeVersion: "v23.11.0", probe })).toBe(0);
    expect(JSON.parse(write.mock.calls[1]?.[0] as string)).toMatchObject({
      checks: expect.arrayContaining([expect.objectContaining({ id: "node", state: "blocked" })]),
    });
    write.mockRestore();
  });

  it("mantém help contextual e erros com código estável", async () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    expect(await run(["help", "setup"])).toBe(0);
    expect(stdout).toHaveBeenCalledWith(expect.stringContaining("Consulta apenas informações"));
    expect(await run(["desconhecido", "--json"])).toBe(2);
    expect(JSON.parse(stdout.mock.calls.at(-1)?.[0] as string)).toMatchObject({
      code: "UNKNOWN_COMMAND",
      ok: false,
    });

    stdout.mockRestore();
    stderr.mockRestore();
  });

  it("mantém a saída humana em até 80 colunas", async () => {
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const longCommand = "x".repeat(160);

    expect(await run([longCommand])).toBe(2);
    const lines = (stderr.mock.calls[0]?.[0] as string).trimEnd().split("\n");
    expect(lines.every((line) => line.length <= 80)).toBe(true);
    stderr.mockRestore();
  });
});
