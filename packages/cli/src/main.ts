function getVersion(): string {
  return process.env.ZERO_VERSION ?? "0.0.0-development";
}

const help = `Zero — fundador guiado de projetos web

Uso:
  zero --help
  zero --version

Comece aqui:
  zero setup    Verifique se sua máquina está pronta.
  zero new      Crie a fundação de um novo projeto.

Nesta versão de fundação, setup e new ainda estão em implementação.
Use "zero <comando> --help" para obter ajuda específica quando disponível.`;

function writeLine(message: string): void {
  process.stdout.write(`${message}\n`);
}

export function run(argumentsList: readonly string[]): number {
  const [command] = argumentsList;

  if (command === undefined || command === "--help" || command === "-h" || command === "help") {
    writeLine(help);
    return 0;
  }

  if (command === "--version" || command === "-v") {
    writeLine(getVersion());
    return 0;
  }

  process.stderr.write(
    `Comando desconhecido: ${command}\nUse "zero --help" para ver os comandos disponíveis.\n`,
  );
  return 2;
}
