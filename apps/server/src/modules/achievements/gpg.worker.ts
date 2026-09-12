import crypto from "node:crypto";
import { prisma } from "../../shared/database/prisma.js";
import { GpgSyncStatus } from "@prisma/client";
import { googlePlayGamesService } from "./gpg.service.js";

export class GooglePlayGamesWorker {
  private workerId: string;
  private intervalTimer?: NodeJS.Timeout;
  private isProcessing = false;

  constructor() {
    this.workerId = `worker_${crypto.randomUUID().slice(0, 8)}`;
  }

  /**
   * Resets orphaned jobs left IN_PROGRESS by crashed workers after a lease timeout (5 minutes).
   */
  public async recoverOrphanedJobs(): Promise<number> {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recovered = await prisma.googlePlayGamesSyncJob.updateMany({
      where: {
        status: GpgSyncStatus.IN_PROGRESS,
        lockedAt: { lt: fiveMinutesAgo },
      },
      data: {
        status: GpgSyncStatus.FAILED_RETRYABLE,
        lastError: "Lease expired: previous worker abandoned job",
      },
    });

    return recovered.count;
  }

  /**
   * Processes a batch of pending or retryable sync jobs with atomic leasing.
   */
  public async processPendingJobs(batchSize = 10): Promise<{ processed: number; succeeded: number }> {
    if (this.isProcessing) return { processed: 0, succeeded: 0 };
    this.isProcessing = true;

    try {
      // First recover any orphaned jobs
      await this.recoverOrphanedJobs();

      const candidates = await prisma.googlePlayGamesSyncJob.findMany({
        where: {
          status: { in: [GpgSyncStatus.PENDING, GpgSyncStatus.FAILED_RETRYABLE] },
          nextAttemptAt: { lte: new Date() },
        },
        take: batchSize,
        orderBy: { nextAttemptAt: "asc" },
      });

      let processed = 0;
      let succeeded = 0;

      for (const candidate of candidates) {
        // Atomic Concurrency Lease: ensure only one worker claims this candidate
        const leaseResult = await prisma.googlePlayGamesSyncJob.updateMany({
          where: {
            id: candidate.id,
            status: { in: [GpgSyncStatus.PENDING, GpgSyncStatus.FAILED_RETRYABLE] },
          },
          data: {
            status: GpgSyncStatus.IN_PROGRESS,
            lockedAt: new Date(),
            lockedBy: this.workerId,
          },
        });

        if (leaseResult.count === 0) {
          // Claimed by another worker process
          continue;
        }

        processed++;

        try {
          const link = await prisma.googlePlayGamesLink.findUnique({
            where: { userId: candidate.userId },
          });

          if (!link || !link.encryptedRefreshToken) {
            await prisma.googlePlayGamesSyncJob.update({
              where: { id: candidate.id },
              data: {
                status: GpgSyncStatus.FAILED_PERMANENT,
                lastError: "No valid Google Play Games link found for user",
              },
            });
            continue;
          }

          // Call PGS unlock
          await googlePlayGamesService.unlockExternalAchievement(
            link.gpgPlayerId,
            candidate.gpgAchievementId,
            link.encryptedRefreshToken
          );

          // Success: update job and userAchievement
          await prisma.$transaction([
            prisma.googlePlayGamesSyncJob.update({
              where: { id: candidate.id },
              data: {
                status: GpgSyncStatus.COMPLETED,
                lastError: null,
              },
            }),
            prisma.userAchievement.update({
              where: { id: candidate.userAchievementId },
              data: { gpgSyncedAt: new Date() },
            }),
          ]);

          succeeded++;
        } catch (err: any) {
          const nextAttemptNumber = candidate.attempts + 1;
          const isPermanent =
            err.isAuthRevoked ||
            err.statusCode === 401 ||
            nextAttemptNumber >= candidate.maxAttempts;

          if (isPermanent) {
            await prisma.googlePlayGamesSyncJob.update({
              where: { id: candidate.id },
              data: {
                status: GpgSyncStatus.FAILED_PERMANENT,
                attempts: nextAttemptNumber,
                lastError: err.message || "Permanent synchronization failure",
              },
            });
          } else {
            // Exponential backoff: base 30s * 2^attempts + bounded jitter (0-5s)
            const baseMs = parseInt(process.env.GPG_RETRY_BASE_MS || "30000", 10);
            const jitterMs = Math.floor(Math.random() * 5000);
            const backoffMs = Math.pow(2, nextAttemptNumber) * baseMs + jitterMs;
            const nextAttemptAt = new Date(Date.now() + backoffMs);

            await prisma.googlePlayGamesSyncJob.update({
              where: { id: candidate.id },
              data: {
                status: GpgSyncStatus.FAILED_RETRYABLE,
                attempts: nextAttemptNumber,
                nextAttemptAt,
                lastError: err.message || "Transient synchronization failure",
              },
            });
          }
        }
      }

      return { processed, succeeded };
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Starts periodic outbox worker.
   */
  public start(intervalMs = 10000) {
    if (this.intervalTimer) return;
    this.intervalTimer = setInterval(() => {
      this.processPendingJobs().catch(() => {});
    }, intervalMs);
  }

  /**
   * Stops periodic outbox worker.
   */
  public stop() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = undefined;
    }
  }
}

export const gpgWorker = new GooglePlayGamesWorker();
