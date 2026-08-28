import Redis from "ioredis";

const ttlSeconds = 300;

function client(): Redis {
  const url = process.env.REDIS_URL;
  if (url === undefined || !url.startsWith("redis://")) throw new Error("Cache local indisponível.");
  return new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1 });
}

export async function cacheExample(): Promise<{ value: string; cached: boolean }> {
  const redis = client();
  try {
    await redis.connect();
    const key = "zero:example:cache";
    const cached = await redis.get(key);
    if (cached !== null) return { value: cached, cached: true };
    const value = `ready-${Date.now()}`;
    await redis.set(key, value, "EX", ttlSeconds);
    return { value, cached: false };
  } finally {
    await redis.quit();
  }
}
