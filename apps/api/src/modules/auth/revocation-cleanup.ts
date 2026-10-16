import type { Database } from "../../config/database.js";
import type { Logger } from "../../config/logger.js";

/** How often expired denylist rows are deleted. */
export const REVOCATION_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Delete denylist rows whose JWT expiry has passed.
 * Active revocations (expiresAt still in the future) are left in place.
 */
export async function purgeExpiredRevokedAccessTokens(
  prisma: Database,
  now: Date = new Date(),
): Promise<number> {
  const result = await prisma.revokedAccessToken.deleteMany({
    where: { expiresAt: { lt: now } },
  });
  return result.count;
}

/**
 * Run one purge immediately, then on an hourly interval.
 * Returns a stop function for graceful shutdown.
 * Overlapping runs are skipped.
 */
export function startRevocationCleanup(
  prisma: Database,
  logger: Logger,
): () => void {
  let stopped = false;
  let running = false;

  const run = async (): Promise<void> => {
    if (stopped || running) {
      return;
    }
    running = true;
    try {
      const deleted = await purgeExpiredRevokedAccessTokens(prisma);
      if (deleted > 0) {
        logger.info({ deleted }, "Purged expired revoked access tokens");
      }
    } catch (error) {
      logger.error(
        { err: error },
        "Failed to purge expired revoked access tokens",
      );
    } finally {
      running = false;
    }
  };

  void run();

  const timer = setInterval(() => {
    void run();
  }, REVOCATION_CLEANUP_INTERVAL_MS);
  timer.unref();

  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
