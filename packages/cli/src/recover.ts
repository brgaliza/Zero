import { spawnSync } from "node:child_process";

import { assertTrustedLocalDockerTransport, readEphemeralRunIntent } from "../../core/src/index.js";

export interface RecoverResult {
  readonly ok: boolean;
  readonly exitCode: number;
  readonly code: string;
  readonly message: string;
}

export async function runRecover(runId: string): Promise<RecoverResult> {
  try {
    const intent = await readEphemeralRunIntent(runId);
    const transport = await assertTrustedLocalDockerTransport();
    for (const resource of [...intent.resources].reverse()) {
      const command =
        resource.type === "image"
          ? ["image", "rm", "--force", resource.name]
          : [resource.type, "rm", "--force", resource.name];
      const result = spawnSync("docker", command, {
        encoding: "utf8",
        env: transport.environment,
        shell: false,
      });
      if (result.status !== 0 && !result.stderr.includes("No such"))
        throw new Error("cleanup falhou");
    }
    return {
      ok: true,
      exitCode: 0,
      code: "RECOVERY_COMPLETED",
      message: "Recursos efêmeros conhecidos foram removidos.",
    };
  } catch {
    return {
      ok: false,
      exitCode: 4,
      code: "RECOVERY_FAILED",
      message: "Não foi possível recuperar esta execução efêmera.",
    };
  }
}
