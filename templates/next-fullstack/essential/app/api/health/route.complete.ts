import { NextResponse } from "next/server";
import Redis from "ioredis";

import { db } from "../../lib/db";

async function smtpAvailable(): Promise<boolean> {
  const port = Number(process.env.ZERO_MAILPIT_SMTP_PORT);
  if (!Number.isInteger(port)) return false;
  const { connect } = await import("node:net");
  return new Promise((resolve) => {
    const socket = connect({ host: process.env.ZERO_MAILPIT_SMTP_HOST ?? "127.0.0.1", port });
    socket.setTimeout(1_000);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

export async function GET() {
  const checks: Record<string, "ok" | "unavailable"> = {
    application: "ok",
    database: "unavailable",
    redis: "unavailable",
    storage: "unavailable",
    email: "unavailable",
  };
  let redis: Redis | undefined;
  try {
    await db.$queryRaw`SELECT 1`;
    checks.database = "ok";
    redis = new Redis(process.env.REDIS_URL ?? "", { lazyConnect: true, maxRetriesPerRequest: 1 });
    await redis.connect();
    await redis.ping();
    checks.redis = "ok";
    const storage = await fetch(
      (process.env.STORAGE_ENDPOINT ?? "http://127.0.0.1:" + process.env.ZERO_MINIO_API_PORT) +
        "/minio/health/live",
      { signal: AbortSignal.timeout(1_000) },
    );
    if (storage.ok) checks.storage = "ok";
    if (await smtpAvailable()) checks.email = "ok";
  } catch {
    // A resposta pública nunca revela detalhes internos.
  } finally {
    await redis?.quit().catch(() => undefined);
  }
  const healthy = Object.values(checks).every((value) => value === "ok");
  return NextResponse.json(
    { status: healthy ? "ok" : "degraded", checks },
    { status: healthy ? 200 : 503 },
  );
}
