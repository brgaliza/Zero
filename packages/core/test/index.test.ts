import { mkdtemp, readFile, realpath, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  completeStage,
  assertLocalProjectOwnership,
  createLocalEnvironment,
  createLocalProjectIdentity,
  findAvailablePort,
  readLocalOperationState,
  createLocalOperationState,
  parseLocalOperationState,
  resumeCompatibility,
  renderLocalEnvironment,
  readLocalProjectIdentity,
  serializeLocalOperationState,
  writeLocalOperationState,
  writeLocalProjectIdentity,
  readEphemeralRunIntent,
  writeEphemeralRunIntent,
} from "../src/index.js";

const manifest = "schemaVersion: 1\nproject:\n  slug: teste\n";
const directory = "/private/tmp/teste";
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { force: true, recursive: true })),
  );
});

describe("estado local da operação", () => {
  it("vincula o journal ao diretório canônico e ao manifesto", () => {
    const state = createLocalOperationState({
      projectDirectory: directory,
      manifestSource: manifest,
      operationId: "0123456789abcdef0123456789abcdef",
    });

    expect(
      resumeCompatibility(state, { projectDirectory: directory, manifestSource: manifest }),
    ).toEqual({
      ok: true,
    });
    expect(
      resumeCompatibility(state, {
        projectDirectory: "/private/tmp/outro",
        manifestSource: manifest,
      }),
    ).toMatchObject({
      ok: false,
    });
    expect(
      resumeCompatibility(state, { projectDirectory: directory, manifestSource: "alterado" }),
    ).toMatchObject({
      ok: false,
    });
  });

  it("serializa e analisa somente o contrato estrito sem segredo", () => {
    const state = completeStage(
      createLocalOperationState({
        projectDirectory: directory,
        manifestSource: manifest,
        operationId: "0123456789abcdef0123456789abcdef",
      }),
      "scaffolded",
    );

    expect(parseLocalOperationState(serializeLocalOperationState(state))).toEqual(state);
    expect(() => parseLocalOperationState('{"schemaVersion":1,"token":"secret"}')).toThrow(
      "campo desconhecido",
    );
  });

  it("rejeita JSON malformado, hashes inválidos e etapas duplicadas", () => {
    expect(() => parseLocalOperationState("{")).toThrow("JSON válido");
    expect(() =>
      parseLocalOperationState(
        '{"schemaVersion":1,"operationId":"0123456789abcdef0123456789abcdef","projectDirectory":"/tmp/a","manifestSha256":"x","completedStages":[]}',
      ),
    ).toThrow("SHA-256");
    expect(() =>
      parseLocalOperationState(
        '{"schemaVersion":1,"operationId":"0123456789abcdef0123456789abcdef","projectDirectory":"/tmp/a","manifestSha256":"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef","completedStages":["scaffolded","scaffolded"]}',
      ),
    ).toThrow("não pode repetir");
  });

  it("renderiza ambiente local com secret exclusivo e porta validada", () => {
    const environment = renderLocalEnvironment({
      databasePort: 55432,
      applicationPort: 3300,
      password: "0123456789abcdefghijklmnopqrstuv",
    });
    expect(environment).toContain('ZERO_POSTGRES_PORT="55432"');
    expect(environment).toContain("DATABASE_URL=");
    expect(() => renderLocalEnvironment({ databasePort: 0, applicationPort: 3300 })).toThrow(
      "porta TCP",
    );
  });

  it("cria .env.local exclusivamente com permissões privadas", async () => {
    const projectDirectory = await mkdtemp(join(tmpdir(), "zero-core-environment-"));
    temporaryDirectories.push(projectDirectory);
    await createLocalEnvironment({ projectDirectory, databasePort: 55432, applicationPort: 3300 });

    await expect(readFile(join(projectDirectory, ".env.local"), "utf8")).resolves.toContain(
      "DATABASE_URL=",
    );
    const environmentStats = await stat(join(projectDirectory, ".env.local"));
    expect(environmentStats.mode & 0o777).toBe(0o600);
    await expect(
      createLocalEnvironment({ projectDirectory, databasePort: 55432, applicationPort: 3300 }),
    ).rejects.toMatchObject({
      code: "EEXIST",
    });
  });

  it("persiste identidade privada que impede cópias de controlar o projeto", async () => {
    const projectDirectory = await mkdtemp(join(tmpdir(), "zero-core-identity-"));
    temporaryDirectories.push(projectDirectory);
    const canonicalDirectory = await realpath(projectDirectory);
    const identity = createLocalProjectIdentity({
      projectDirectory: canonicalDirectory,
      slug: "teste",
      projectId: "0123456789abcdef0123456789abcdef",
    });

    await writeLocalProjectIdentity(canonicalDirectory, identity);
    await expect(readLocalProjectIdentity(projectDirectory)).resolves.toEqual(identity);
    await expect(assertLocalProjectOwnership(projectDirectory)).resolves.toEqual(identity);
    expect((await stat(join(projectDirectory, ".zero/identity.local.json"))).mode & 0o777).toBe(
      0o600,
    );
  });

  it("encontra uma porta local disponível a partir da preferência", async () => {
    await expect(findAvailablePort(55432)).resolves.toBeGreaterThanOrEqual(55432);
    await expect(findAvailablePort(0)).rejects.toThrow("porta TCP");
  });

  it("persiste o journal atomizado sem incluir secrets", async () => {
    const projectDirectory = await mkdtemp(join(tmpdir(), "zero-core-journal-"));
    temporaryDirectories.push(projectDirectory);
    const state = createLocalOperationState({
      projectDirectory,
      manifestSource: manifest,
      operationId: "0123456789abcdef0123456789abcdef",
    });
    await writeLocalOperationState(projectDirectory, state);
    await expect(readLocalOperationState(projectDirectory)).resolves.toEqual(state);
    await expect(
      readFile(join(projectDirectory, ".zero/journal.local.json"), "utf8"),
    ).resolves.not.toContain("PASSWORD");
  });

  it("persiste intenção efêmera privada, estrita e recuperável", async () => {
    const stateDirectory = await mkdtemp(join(tmpdir(), "zero-core-runs-"));
    temporaryDirectories.push(stateDirectory);
    const intent = {
      schemaVersion: 1 as const,
      runId: "0123456789abcdef01234567",
      projectDirectory: directory,
      purpose: "build" as const,
      stage: "created",
      resources: [{ type: "image" as const, name: "zero-run-0123456789abcdef" }],
    };
    await writeEphemeralRunIntent(intent, stateDirectory);
    await expect(readEphemeralRunIntent(intent.runId, stateDirectory)).resolves.toEqual(intent);
    expect((await stat(join(stateDirectory, `${intent.runId}.json`))).mode & 0o777).toBe(0o600);
  });
});
