import { redis } from "./redis";

const LOCK_TTL_MS = 5000; // 5 seconds

export async function acquireLock(key: string): Promise<string | null> {
  const lockId = crypto.randomUUID();
  const lockKey = `lock:${key}`;
  const result = await redis.set(lockKey, lockId, {
    px: LOCK_TTL_MS,
    nx: true,
  });
  return result === "OK" ? lockId : null;
}

export async function releaseLock(key: string, lockId: string): Promise<void> {
  const lockKey = `lock:${key}`;
  const current = await redis.get(lockKey);
  if (current === lockId) {
    await redis.del(lockKey);
  }
}
