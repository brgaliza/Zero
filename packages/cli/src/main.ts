import { spawnSync } from "node:child_process";

type CheckState = "ready" | "blocked" | "future" | "optional" | "unknown";
type ProbeResult =
  | { readonly kind: "detected"; readonly version: string }
  | { readonly kind: "missing" }
  | { readonly kind: "unknown" };

const OFFICIAL_URLS = {
  docker: "https://docs.docker.com/desktop/setup/install/mac-install/",
  git: "https://git-scm.com/downloads/mac",
  github: "https://cli.github.com/",
  node: "https://nodejs.org/en/download",
  npm: "https://docs.npmjs.com/downloading-and-installing-node-js-and-npm",
} as const;

interface SetupCheck {
  readonly id: string;
  readonly label: string;
  readonly state: CheckState;
  readonly detail: string;
  readonly action: string;
  readonly url: string;
}

interface CommandResult {
  readonly ok: boolean;
  readonly command: string;
  readonly exitCode?: number;
  readonly code?: string;
  readonly message?: string;
  readonly nextAction?: string;
  readonly result?: { readonly directory: string; readonly slug: string };
  readonly checks?: readonly (
    | SetupCheck
    | {
        readonly id: string;
        readonly label: string;
        readonly state: CheckState;
        readonly detail: string;
        readonly action: string;
      }
  )[];
}

export interface CliRuntime {
  readonly nodeVersion: string;
  probe(command: "npm" | "docker" | "git" | "gh"): ProbeResult;
}

function getVersion(): string {
  return process.env.ZERO_VERSION ?? "0.0.0-development";
}

function defaultRuntime(): CliRuntime {
  return {
    nodeVersion: process.version,
    probe(command) {
      const env = {
        LANG: process.env.LANG ?? "pt_BR.UTF-8",
        LC_ALL: process.env.LC_ALL ?? "",
        PATH: process.env.PATH ?? "",
      };
      const result = spawnSync(command, ["--version"], {
        encoding: "utf8",
        env,
        shell: false,
        timeout: 2_000,
      });
      if (result.status !== 0) {
        return (result.error as NodeJS.ErrnoException | undefined)?.code === "ENOENT"
          ? { kind: "missing" }
          : { kind: "unknown" };
      }
      const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
      return output.length > 0 ? { kind: "detected", version: output } : { kind: "unknown" };
    },
  };
}

const rootHelp = `Zero — fundador guiado de projetos web

Uso:
  zero setup [--json]
  zero new
  zero new --config <arquivo> --yes
  zero new --resume <diretório>
  zero doctor
  zero up
  zero down
  zero status
  zero logs [app|db]
  zero test [--e2e]
  zero build
  zero recover <run-id> --yes
  zero help <comando>

Comandos disponíveis:
  setup  Verifica requisitos atuais e futuros da máquina.
  new    Cria a fundação estática de um projeto.
  doctor Diagnostica o contrato e os pré-requisitos do projeto atual.
  up     Inicia banco, migrations, seed e aplicação do projeto atual.
  down   Encerra a infraestrutura local e preserva os volumes.
  status Consulta o estado da infraestrutura local.
  logs   Exibe logs sanitizados de um serviço local.
  test   Executa validação rápida do projeto atual.
  build  Constrói a imagem de produção do projeto atual.
  recover Remove recursos efêmeros órfãos de um run-id conhecido.

Opções globais: --help, -h, --version, -v e --json.
Use "zero help <comando>" para detalhes. NO_COLOR=1 não altera a saída.`;

const setupHelp = `Uso:
  zero setup [--json]

Consulta apenas informações de leitura da máquina. Node 24 ou superior e npm 11 são
requisitos atuais. Docker também é requisito atual; Git e GitHub CLI são
opcionais para recursos posteriores. Nada é instalado, iniciado ou alterado.`;

const newHelp = `Uso:
  zero new
  zero new --config <arquivo> --yes
  zero new --resume <diretório>

Cria a fundação estática do perfil essential. O assistente pede nome, descrição,
slug e pasta, mostra um resumo e exige confirmação. O modo declarativo escreve
somente um envelope JSON em stdout.`;

const doctorHelp = `Uso:
  zero doctor [--json]

Valida somente o contrato portátil do projeto e a disponibilidade local de
Docker. Nunca exibe nem interpreta os valores de .env.local.`;

const upHelp = `Uso:
  zero up

Cria .env.local somente se ele não existir, inicia o PostgreSQL local, aplica
migrations versionadas, executa seed e mantém a aplicação em primeiro plano.`;

const downHelp = `Uso:
  zero down

Encerra somente o namespace Docker do projeto atual. Não remove volumes, banco
ou arquivos do projeto.`;

const statusHelp = `Uso:
  zero status [--json]

Consulta somente o estado dos serviços Docker do projeto atual. Não lê
.env.local nem exibe valores sensíveis.`;

const logsHelp = `Uso:
  zero logs [app|db]

Exibe os últimos logs do PostgreSQL ou o log local sanitizado da aplicação.`;

const testHelp = `Uso:
  zero test
  zero test --e2e

Executa a validação rápida do projeto. O modo e2e valida a pilha Docker isolada.`;

const buildHelp = `Uso:
  zero build

Constrói a imagem de produção do projeto atual.`;

const recoverHelp = `Uso:
  zero recover <run-id> --yes

Remove somente recursos efêmeros registrados pelo Zero para a execução indicada.`;

function major(version: string): number | undefined {
  const match = /^v?(\d+)/u.exec(version.trim());
  return match?.[1] === undefined ? undefined : Number(match[1]);
}

function supportedNode(majorVersion: number | undefined): boolean {
  return majorVersion === 24 || majorVersion === 26;
}

function setupChecks(runtime: CliRuntime): readonly SetupCheck[] {
  const nodeMajor = major(runtime.nodeVersion);
  const npm = runtime.probe("npm");
  const npmMajor = npm.kind === "detected" ? major(npm.version) : undefined;
  const docker = runtime.probe("docker");
  const git = runtime.probe("git");
  const github = runtime.probe("gh");

  return [
    {
      id: "node",
      label: "Node.js 24 ou 26",
      state: supportedNode(nodeMajor) ? "ready" : "blocked",
      detail:
        supportedNode(nodeMajor)
          ? `Disponível (${runtime.nodeVersion}).`
          : `Requer Node.js 24 ou 26; encontrado ${runtime.nodeVersion}.`,
      action:
        supportedNode(nodeMajor)
          ? "Nenhuma ação necessária."
          : "Instale o Node.js 24 ou 26 e execute zero setup novamente.",
      url: OFFICIAL_URLS.node,
    },
    {
      id: "npm",
      label: "npm 11",
      state: npm.kind === "unknown" ? "unknown" : npmMajor === 11 ? "ready" : "blocked",
      detail:
        npm.kind === "unknown"
          ? "Não foi possível verificar o npm."
          : npmMajor === 11
            ? "Disponível."
            : "Requer npm 11.",
      action:
        npm.kind === "unknown"
          ? "Verifique permissões e execute zero setup novamente."
          : npmMajor === 11
            ? "Nenhuma ação necessária."
            : "Instale o npm 11 e execute zero setup novamente.",
      url: OFFICIAL_URLS.npm,
    },
    {
      id: "docker",
      label: "Docker",
      state:
        docker.kind === "unknown" ? "unknown" : docker.kind === "detected" ? "ready" : "blocked",
      detail:
        docker.kind === "unknown"
          ? "Não foi possível verificar o Docker."
          : docker.kind === "missing"
            ? "Docker é necessário para o ciclo local da Sprint 2."
            : "Disponível para o ciclo local.",
      action:
        docker.kind === "unknown"
          ? "Verifique permissões e execute zero setup novamente."
          : docker.kind === "detected"
            ? "Nenhuma ação necessária."
            : "Instale e inicie o Docker Desktop antes de continuar.",
      url: OFFICIAL_URLS.docker,
    },
    {
      id: "git",
      label: "Git",
      state: git.kind === "unknown" ? "unknown" : "optional",
      detail:
        git.kind === "unknown"
          ? "Não foi possível verificar o Git."
          : git.kind === "missing"
            ? "Opcional para recursos posteriores."
            : "Detectado; opcional nesta sprint.",
      action:
        git.kind === "unknown"
          ? "Verifique permissões e execute zero setup novamente."
          : git.kind === "detected"
            ? "Nenhuma ação necessária nesta sprint."
            : "Instale o Git apenas se precisar dos recursos posteriores.",
      url: OFFICIAL_URLS.git,
    },
    {
      id: "github",
      label: "GitHub CLI",
      state: github.kind === "unknown" ? "unknown" : "optional",
      detail:
        github.kind === "unknown"
          ? "Não foi possível verificar o GitHub CLI."
          : github.kind === "missing"
            ? "Opcional para repositórios privados depois."
            : "Detectado; opcional nesta sprint.",
      action:
        github.kind === "unknown"
          ? "Verifique permissões e execute zero setup novamente."
          : github.kind === "detected"
            ? "Nenhuma ação necessária nesta sprint."
            : "Instale o GitHub CLI apenas se precisar de repositórios privados.",
      url: OFFICIAL_URLS.github,
    },
  ];
}

function resultText(result: CommandResult): string {
  if (!result.ok) {
    return wrap80(
      `${result.message ?? "O comando não pôde ser executado."}\nUse "zero --help" para ver os comandos disponíveis.`,
    );
  }
  const checks = result.checks ?? [];
  if (checks.length === 0) return wrap80(result.message ?? "Comando concluído.");
  const stateLabels: Record<CheckState, string> = {
    blocked: "BLOQUEADOR",
    future: "SPRINT 2",
    optional: "OPCIONAL",
    ready: "PRONTO",
    unknown: "INDETERMINADO",
  };
  return wrap80(
    `Diagnóstico do Zero\n\n${checks.map((check) => `${stateLabels[check.state]} ${check.label}\n${check.detail}\nAção: ${check.action}${"url" in check ? `\nMais informações: ${check.url}` : ""}`).join("\n\n")}\n\nNenhuma alteração foi feita na sua máquina.`,
  );
}

function wrap80(message: string): string {
  return message
    .split("\n")
    .flatMap((line) => {
      if (line.length <= 80) return [line];
      const words = line.split(" ");
      const lines: string[] = [];
      let current = "";
      for (const word of words) {
        if (current.length > 0 && current.length + word.length + 1 > 80) {
          lines.push(current);
          current = word;
        } else current = current.length === 0 ? word : `${current} ${word}`;
      }
      if (current.length > 0) lines.push(current);
      return lines.flatMap((candidate) =>
        candidate.length <= 80
          ? [candidate]
          : Array.from({ length: Math.ceil(candidate.length / 80) }, (_, index) =>
              candidate.slice(index * 80, (index + 1) * 80),
            ),
      );
    })
    .join("\n");
}

function writeResult(result: CommandResult, json: boolean): void {
  (json ? process.stdout : result.ok ? process.stdout : process.stderr).write(
    `${json ? JSON.stringify({ schemaVersion: 1, ...result, exitCode: result.exitCode ?? (result.ok ? 0 : 4) }) : resultText(result)}\n`,
  );
}

function parseArguments(argumentsList: readonly string[]): {
  readonly values: string[];
  readonly json: boolean;
} {
  let json = false;
  const values: string[] = [];
  for (const argument of argumentsList) {
    if (argument === "--json") json = true;
    else values.push(argument);
  }
  return { values, json };
}

function fail(command: string, code: string, message: string): CommandResult {
  return { ok: false, command, code, message };
}

function newCommandResult(result: {
  readonly ok: boolean;
  readonly exitCode: number;
  readonly code: string;
  readonly message: string;
  readonly nextAction?: string;
  readonly result?: { readonly directory: string; readonly slug: string };
}): CommandResult {
  return { command: "new", ...result };
}

export async function run(
  argumentsList: readonly string[],
  runtime: CliRuntime = defaultRuntime(),
): Promise<number> {
  const { values, json } = parseArguments(argumentsList);
  const [command, ...options] = values;

  if (command === undefined || command === "--help" || command === "-h") {
    process.stdout.write(`${rootHelp}\n`);
    return 0;
  }
  if (command === "--version" || command === "-v") {
    process.stdout.write(`${getVersion()}\n`);
    return 0;
  }
  if (command === "help") {
    const target = options[0];
    if (target === "setup") process.stdout.write(`${setupHelp}\n`);
    else if (target === "new") process.stdout.write(`${newHelp}\n`);
    else if (target === "doctor") process.stdout.write(`${doctorHelp}\n`);
    else if (target === "up") process.stdout.write(`${upHelp}\n`);
    else if (target === "down") process.stdout.write(`${downHelp}\n`);
    else if (target === "status") process.stdout.write(`${statusHelp}\n`);
    else if (target === "logs") process.stdout.write(`${logsHelp}\n`);
    else if (target === "test") process.stdout.write(`${testHelp}\n`);
    else if (target === "build") process.stdout.write(`${buildHelp}\n`);
    else if (target === "recover") process.stdout.write(`${recoverHelp}\n`);
    else {
      writeResult(fail("help", "INVALID_ARGUMENTS", 'Informe um comando após "zero help".'), json);
      return 2;
    }
    return 0;
  }
  if (command === "setup") {
    if (options[0] === "--help" || options[0] === "-h") {
      process.stdout.write(`${setupHelp}\n`);
      return 0;
    }
    if (options.length > 0) {
      writeResult(
        fail("setup", "INVALID_ARGUMENTS", 'A opção não é aceita por "zero setup".'),
        json,
      );
      return 2;
    }
    writeResult({ ok: true, command: "setup", checks: setupChecks(runtime) }, json);
    return 0;
  }
  if (command === "new") {
    if (options[0] === "--help" || options[0] === "-h") {
      process.stdout.write(`${newHelp}\n`);
      return 0;
    }
    const newModule = await import("./" + "new.cjs");
    const npm = runtime.probe("npm");
    const newRuntime = newModule.defaultNewRuntime({
      nodeVersion: runtime.nodeVersion,
      npmVersion: npm.kind === "detected" ? npm.version : undefined,
    });
    const declarative = options.includes("--config") || options.includes("--yes");
    const result = declarative
      ? options[0] === "--config" && options[1] !== undefined && options[2] === "--yes"
        ? await newModule.runDeclarative(options[1], true, newRuntime)
        : {
            ok: false,
            exitCode: 2,
            code: "INVALID_ARGUMENTS",
            message: "Use exatamente: zero new --config <arquivo> --yes.",
          }
      : options[0] === "--resume" && options[1] !== undefined && options.length === 2
        ? await newModule.runResume(options[1])
        : options.length === 0
          ? await newModule.runGuided(newRuntime)
          : {
              ok: false,
              exitCode: 2,
              code: "INVALID_ARGUMENTS",
              message: 'Use "zero new --help" para ver as opções aceitas.',
            };
    writeResult(newCommandResult(result), declarative || json);
    return result.exitCode;
  }
  if (command === "doctor") {
    if (options[0] === "--help" || options[0] === "-h") {
      process.stdout.write(`${doctorHelp}\n`);
      return 0;
    }
    if (options.length > 0) {
      writeResult(fail("doctor", "INVALID_ARGUMENTS", 'Use "zero doctor --help".'), json);
      return 2;
    }
    const doctorModule = await import("./" + "doctor.cjs");
    const result = await doctorModule.runDoctor();
    writeResult({ command: "doctor", ...result }, json);
    return result.exitCode;
  }
  if (command === "up") {
    if (options[0] === "--help" || options[0] === "-h") {
      process.stdout.write(`${upHelp}\n`);
      return 0;
    }
    if (options.length > 0 || json) {
      writeResult(fail("up", "INVALID_ARGUMENTS", 'Use "zero up" sem opções.'), json);
      return 2;
    }
    const upModule = await import("./" + "up.cjs");
    const result = await upModule.runUp();
    writeResult({ command: "up", ...result }, false);
    return result.exitCode;
  }
  if (command === "down") {
    if (options[0] === "--help" || options[0] === "-h") {
      process.stdout.write(`${downHelp}\n`);
      return 0;
    }
    if (options.length > 0 || json) {
      writeResult(fail("down", "INVALID_ARGUMENTS", 'Use "zero down" sem opções.'), json);
      return 2;
    }
    const downModule = await import("./" + "down.cjs");
    const result = await downModule.runDown();
    writeResult({ command: "down", ...result }, false);
    return result.exitCode;
  }
  if (command === "status") {
    if (options[0] === "--help" || options[0] === "-h") {
      process.stdout.write(`${statusHelp}\n`);
      return 0;
    }
    if (options.length > 0) {
      writeResult(fail("status", "INVALID_ARGUMENTS", 'Use "zero status --help".'), json);
      return 2;
    }
    const statusModule = await import("./" + "status.cjs");
    const result = await statusModule.runStatus();
    writeResult({ command: "status", ...result }, json);
    return result.exitCode;
  }
  if (command === "logs") {
    if (options[0] === "--help" || options[0] === "-h") {
      process.stdout.write(`${logsHelp}\n`);
      return 0;
    }
    if (json) {
      writeResult(fail("logs", "INVALID_ARGUMENTS", 'Use "zero logs [app|db]".'), true);
      return 2;
    }
    const logsModule = await import("./" + "logs.cjs");
    const result = await logsModule.runLogs(options[0]);
    writeResult({ command: "logs", ...result }, false);
    return result.exitCode;
  }
  if (command === "test") {
    if (options[0] === "--help" || options[0] === "-h") {
      process.stdout.write(`${testHelp}\n`);
      return 0;
    }
    if (json || !(options.length === 0 || (options.length === 1 && options[0] === "--e2e"))) {
      writeResult(fail("test", "INVALID_ARGUMENTS", 'Use "zero test [--e2e]".'), json);
      return 2;
    }
    const testModule = await import("./" + "test.cjs");
    const result = await testModule.runTest(options[0] === "--e2e");
    writeResult({ command: "test", ...result }, false);
    return result.exitCode;
  }
  if (command === "build") {
    if (options[0] === "--help" || options[0] === "-h") {
      process.stdout.write(`${buildHelp}\n`);
      return 0;
    }
    if (options.length > 0 || json) {
      writeResult(fail("build", "INVALID_ARGUMENTS", 'Use "zero build".'), json);
      return 2;
    }
    const buildModule = await import("./" + "build.cjs");
    const result = await buildModule.runBuild();
    writeResult({ command: "build", ...result }, false);
    return result.exitCode;
  }
  if (command === "recover") {
    if (options[0] === "--help" || options[0] === "-h") {
      process.stdout.write(`${recoverHelp}\n`);
      return 0;
    }
    if (options.length !== 2 || options[1] !== "--yes" || json) {
      writeResult(fail("recover", "INVALID_ARGUMENTS", 'Use "zero recover <run-id> --yes".'), json);
      return 2;
    }
    const recoverModule = await import("./" + "recover.cjs");
    const result = await recoverModule.runRecover(options[0]);
    writeResult({ command: "recover", ...result }, false);
    return result.exitCode;
  }
  writeResult(fail("unknown", "UNKNOWN_COMMAND", `Comando desconhecido: ${command}`), json);
  return 2;
}
