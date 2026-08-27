import {
  chmod,
  lstat,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  materializeTemplate,
  resolveProjectDestination,
  ResolvedDestination,
  ScaffoldError,
} from "../src/index.js";

const temporaryDirectories: string[] = [];

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "zero-scaffold-test-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe("resolveProjectDestination", () => {
  it("resolve caminho relativo contra o diretório de configuração", async () => {
    const parent = await createTemporaryDirectory();
    const result = await resolveProjectDestination({
      configurationDirectory: parent,
      directory: "meu-projeto",
      homeDirectory: parent,
    });

    const canonicalParent = await realpath(parent);
    expect(result.directory).toBe(join(canonicalParent, "meu-projeto"));
    expect(result.parentDirectory).toBe(canonicalParent);
  });

  it("recusa destino existente e symlink", async () => {
    const parent = await createTemporaryDirectory();
    const existing = join(parent, "existente");
    await mkdir(existing);

    await expect(
      resolveProjectDestination({ configurationDirectory: parent, directory: "existente" }),
    ).rejects.toMatchObject({ code: "DESTINATION_CONFLICT" } satisfies Partial<ScaffoldError>);

    const link = join(parent, "link");
    await symlink(existing, link);
    await expect(
      resolveProjectDestination({ configurationDirectory: parent, directory: "link" }),
    ).rejects.toMatchObject({ code: "DESTINATION_CONFLICT" } satisfies Partial<ScaffoldError>);

    await writeFile(join(parent, "arquivo"), "não sobrescrever");
    await expect(
      resolveProjectDestination({ configurationDirectory: parent, directory: "arquivo" }),
    ).rejects.toMatchObject({ code: "DESTINATION_CONFLICT" } satisfies Partial<ScaffoldError>);
  });

  it("expande ~/ de forma controlada e preserva espaços e Unicode", async () => {
    const homeDirectory = await createTemporaryDirectory();
    const result = await resolveProjectDestination({
      configurationDirectory: "/não-deve-ser-usado",
      directory: "~/Projeto ágil",
      homeDirectory,
    });

    expect(result.directory).toBe(join(await realpath(homeDirectory), "Projeto ágil"));
  });

  it("recusa glob, expansão de shell, controles, traversal e pai ausente", async () => {
    const parent = await createTemporaryDirectory();

    await expect(
      resolveProjectDestination({ configurationDirectory: parent, directory: "$(whoami)" }),
    ).rejects.toMatchObject({ code: "INVALID_DESTINATION" } satisfies Partial<ScaffoldError>);
    await expect(
      resolveProjectDestination({ configurationDirectory: parent, directory: "../fora" }),
    ).rejects.toMatchObject({ code: "INVALID_DESTINATION" } satisfies Partial<ScaffoldError>);
    await expect(
      resolveProjectDestination({
        configurationDirectory: parent,
        directory: "~/../fora",
        homeDirectory: parent,
      }),
    ).rejects.toMatchObject({ code: "INVALID_DESTINATION" } satisfies Partial<ScaffoldError>);
    await expect(
      resolveProjectDestination({
        configurationDirectory: parent,
        directory: "nome\u202einseguro",
      }),
    ).rejects.toMatchObject({ code: "INVALID_DESTINATION" } satisfies Partial<ScaffoldError>);
    await expect(
      resolveProjectDestination({
        configurationDirectory: parent,
        directory: "nome\u200einseguro",
      }),
    ).rejects.toMatchObject({ code: "INVALID_DESTINATION" } satisfies Partial<ScaffoldError>);
    await expect(
      resolveProjectDestination({ configurationDirectory: parent, directory: "ausente/projeto" }),
    ).rejects.toMatchObject({ code: "PARENT_UNAVAILABLE" } satisfies Partial<ScaffoldError>);
  });
});

describe("materializeTemplate", () => {
  it("publica uma árvore determinística somente após concluir o staging", async () => {
    const parent = await createTemporaryDirectory();
    const destination = await resolveProjectDestination({
      configurationDirectory: parent,
      directory: "meu-projeto",
    });

    await materializeTemplate(destination, [
      { path: "src/index.ts", contents: "export const value = 1;\n" },
      { path: "README.md", contents: "# Meu projeto\n" },
    ]);

    await expect(readFile(join(destination.directory, "README.md"), "utf8")).resolves.toBe(
      "# Meu projeto\n",
    );
    await expect(readFile(join(destination.directory, "src", "index.ts"), "utf8")).resolves.toBe(
      "export const value = 1;\n",
    );
  });

  it.each([
    "../fora.txt",
    "/absoluto.txt",
    "src//index.ts",
    "src\\index.ts",
    "arquivo\u061cinseguro.txt",
  ])("recusa caminho inseguro no template: %s", async (templatePath) => {
    const parent = await createTemporaryDirectory();
    const destination = await resolveProjectDestination({
      configurationDirectory: parent,
      directory: "meu-projeto",
    });

    await expect(
      materializeTemplate(destination, [{ path: templatePath, contents: "conteúdo" }]),
    ).rejects.toMatchObject({ code: "INVALID_TEMPLATE" } satisfies Partial<ScaffoldError>);
  });

  it("recusa inventário com arquivo duplicado", async () => {
    const parent = await createTemporaryDirectory();
    const destination = await resolveProjectDestination({
      configurationDirectory: parent,
      directory: "meu-projeto",
    });

    await expect(
      materializeTemplate(destination, [
        { path: "README.md", contents: "um" },
        { path: "README.md", contents: "dois" },
      ]),
    ).rejects.toMatchObject({ code: "INVALID_TEMPLATE" } satisfies Partial<ScaffoldError>);

    await expect(
      materializeTemplate(destination, [
        { path: "café.txt", contents: "um" },
        { path: "cafe\u0301.txt", contents: "dois" },
      ]),
    ).rejects.toMatchObject({ code: "INVALID_TEMPLATE" } satisfies Partial<ScaffoldError>);
  });

  it("recusa um destino forjado fora do resolvedor seguro", async () => {
    const parent = await createTemporaryDirectory();
    const forgedDestination = {
      directory: join(parent, "forjado"),
      parentDirectory: parent,
    } as ResolvedDestination;

    await expect(materializeTemplate(forgedDestination, [])).rejects.toMatchObject({
      code: "INVALID_DESTINATION",
    } satisfies Partial<ScaffoldError>);

    const prototypeForgedDestination = Object.create(
      ResolvedDestination.prototype,
    ) as ResolvedDestination;
    Object.assign(prototypeForgedDestination, {
      directory: join(parent, "forjado-com-prototipo"),
      parentDirectory: parent,
    });
    await expect(materializeTemplate(prototypeForgedDestination, [])).rejects.toMatchObject({
      code: "INVALID_DESTINATION",
    } satisfies Partial<ScaffoldError>);
  });

  it("permite somente uma criação concorrente, inclusive para árvore vazia", async () => {
    const parent = await createTemporaryDirectory();
    const destination = await resolveProjectDestination({
      configurationDirectory: parent,
      directory: "meu-projeto",
    });

    const attempts = await Promise.allSettled([
      materializeTemplate(destination, []),
      materializeTemplate(destination, []),
    ]);

    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter((attempt) => attempt.status === "rejected")).toHaveLength(1);
    const rejectedAttempt = attempts.find(
      (attempt): attempt is PromiseRejectedResult => attempt.status === "rejected",
    );
    expect(rejectedAttempt?.reason).toMatchObject({
      code: "DESTINATION_CONFLICT",
    } satisfies Partial<ScaffoldError>);
  });

  it("limpa staging e não publica destino quando uma escrita falha", async () => {
    const parent = await createTemporaryDirectory();
    const destination = await resolveProjectDestination({
      configurationDirectory: parent,
      directory: "meu-projeto",
    });

    await expect(
      materializeTemplate(destination, [
        { path: "README.md", contents: undefined as unknown as Uint8Array },
      ]),
    ).rejects.toMatchObject({ code: "WRITE_FAILED" } satisfies Partial<ScaffoldError>);

    await expect(lstat(destination.directory)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readdir(parent)).resolves.not.toContainEqual(expect.stringMatching(/^\.zero-/u));
  });

  it("limpa staging e não publica destino quando a criação é interrompida", async () => {
    const parent = await createTemporaryDirectory();
    const destination = await resolveProjectDestination({
      configurationDirectory: parent,
      directory: "meu-projeto",
    });

    await expect(
      materializeTemplate(destination, [{ path: "README.md", contents: "conteúdo" }], {
        shouldAbort: () => true,
      }),
    ).rejects.toMatchObject({ code: "WRITE_FAILED" } satisfies Partial<ScaffoldError>);

    await expect(lstat(destination.directory)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readdir(parent)).resolves.not.toContainEqual(expect.stringMatching(/^\.zero-/u));
  });

  it("reporta todos os itens pendentes se staging e reserva não puderem ser limpos", async () => {
    const parent = await createTemporaryDirectory();
    const destination = await resolveProjectDestination({
      configurationDirectory: parent,
      directory: "meu-projeto",
    });
    const contents = {
      async *[Symbol.asyncIterator](): AsyncGenerator<Uint8Array> {
        await chmod(parent, 0o500);
        throw new Error("falha de escrita simulada");
      },
    } as unknown as Uint8Array;

    try {
      await expect(
        materializeTemplate(destination, [{ path: "README.md", contents }]),
      ).rejects.toMatchObject({
        code: "CLEANUP_REQUIRED",
        cleanupIdentifiers: [
          expect.stringMatching(/^\.zero-staging-/u),
          expect.stringMatching(/^\.zero-create-/u),
        ],
      } satisfies Partial<ScaffoldError>);
    } finally {
      await chmod(parent, 0o700);
    }
  });
});
