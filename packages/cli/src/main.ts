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
  readonly code?: string;
  readonly message?: string;
  readonly checks?: readonly SetupCheck[];
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
  zero new --help
  zero help <comando>

Comandos disponíveis:
  setup  Verifica requisitos atuais e futuros da máquina.
  new    Cria a fundação de um projeto (próximo incremento).

Opções globais: --help, -h, --version, -v e --json.
Use "zero help <comando>" para detalhes. NO_COLOR=1 não altera a saída.`;

const setupHelp = `Uso:
  zero setup [--json]

Consulta apenas informações de leitura da máquina. Node 24 e npm 11 são
requisitos atuais. Docker será necessário na Sprint 2; Git e GitHub CLI são
opcionais para recursos posteriores. Nada é instalado, iniciado ou alterado.`;

const newHelp = `Uso:
  zero new
  zero new --config <arquivo> --yes

O assistente guiado e o modo declarativo chegam no próximo incremento. Nesta
sprint, este comando ainda não cria diretórios nem executa npm, Git ou Docker.`;

function major(version: string): number | undefined {
  const match = /^v?(\d+)/u.exec(version.trim());
  return match?.[1] === undefined ? undefined : Number(match[1]);
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
      label: "Node.js 24",
      state: nodeMajor === 24 ? "ready" : "blocked",
      detail:
        nodeMajor === 24
          ? `Disponível (${runtime.nodeVersion}).`
          : `Requer Node.js 24; encontrado ${runtime.nodeVersion}.`,
      action:
        nodeMajor === 24
          ? "Nenhuma ação necessária."
          : "Instale o Node.js 24 e execute zero setup novamente.",
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
      state: docker.kind === "unknown" ? "unknown" : "future",
      detail:
        docker.kind === "unknown"
          ? "Não foi possível verificar o Docker."
          : docker.kind === "missing"
            ? "Será exigido na Sprint 2; não bloqueia agora."
            : "Detectado; será usado na Sprint 2.",
      action:
        docker.kind === "unknown"
          ? "Verifique permissões e execute zero setup novamente."
          : docker.kind === "detected"
            ? "Valide novamente antes de iniciar a Sprint 2."
            : "Instale o Docker antes da Sprint 2.",
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
  const stateLabels: Record<CheckState, string> = {
    blocked: "BLOQUEADOR",
    future: "SPRINT 2",
    optional: "OPCIONAL",
    ready: "PRONTO",
    unknown: "INDETERMINADO",
  };
  return wrap80(
    `Diagnóstico do Zero\n\n${checks.map((check) => `${stateLabels[check.state]} ${check.label}\n${check.detail}\nAção: ${check.action}\nMais informações: ${check.url}`).join("\n\n")}\n\nNenhuma alteração foi feita na sua máquina.`,
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
    `${json ? JSON.stringify({ schemaVersion: 1, ...result }) : resultText(result)}\n`,
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

export function run(
  argumentsList: readonly string[],
  runtime: CliRuntime = defaultRuntime(),
): number {
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
    writeResult(
      fail("new", "UNAVAILABLE_COMMAND", "zero new será disponibilizado no próximo incremento."),
      json,
    );
    return 3;
  }
  writeResult(fail("unknown", "UNKNOWN_COMMAND", `Comando desconhecido: ${command}`), json);
  return 2;
}
