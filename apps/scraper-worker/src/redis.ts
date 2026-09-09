import { Redis } from "ioredis";

const RETRY_MS = 10_000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function connectRedis(
  redisUrl: string,
  onWaiting?: () => void,
): Promise<Redis> {
  let loggedWaiting = false;

  for (;;) {
    const connection = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
      connectTimeout: 1500,
      retryStrategy: () => null,
    });
    connection.on("error", () => undefined);

    try {
      await connection.connect();
      const pong = await connection.ping();
      if (pong === "PONG") {
        return connection;
      }
    } catch {
      connection.disconnect();
      if (!loggedWaiting) {
        onWaiting?.();
        loggedWaiting = true;
      }
      await delay(RETRY_MS);
      continue;
    }

    connection.disconnect();
    if (!loggedWaiting) {
      onWaiting?.();
      loggedWaiting = true;
    }
    await delay(RETRY_MS);
  }
}
