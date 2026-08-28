import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const homes: string[] = [];

afterEach(async () => {
  await Promise.all(
    homes.splice(0).map((directory) => rm(directory, { force: true, recursive: true })),
  );
  vi.restoreAllMocks();
});

describe("zero report", () => {
  it("persiste somente o schema sanitizado com permissões privadas", async () => {
    const home = await mkdtemp(join(tmpdir(), "zero-report-"));
    homes.push(home);
    const { runReport } = await import("../src/report.js");

    const unsafeChecks = [{ id: "docker", state: "desktop-stopped", detail: "token=secret" }];
    await expect(
      runReport({ homeDirectory: home, zeroVersion: "1.2.3", checks: unsafeChecks }),
    ).resolves.toMatchObject({ ok: true, code: "REPORT_CREATED" });
    const path = join(home, ".zero", "reports", "zero-report.json");
    const report = JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
    expect(report).toMatchObject({
      schemaVersion: 1,
      zeroVersion: "1.2.3",
      checks: [{ id: "docker", state: "desktop-stopped" }],
    });
    expect(JSON.stringify(report)).not.toContain("secret");
    expect((await stat(path)).mode & 0o777).toBe(0o600);
  });
});
