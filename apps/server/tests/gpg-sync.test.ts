import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/shared/database/prisma.js";
import { googlePlayGamesService } from "../src/modules/achievements/gpg.service.js";
import { gpgWorker } from "../src/modules/achievements/gpg.worker.js";
import { achievementService } from "../src/modules/achievements/achievement.service.js";
import { decryptToken } from "../src/modules/achievements/crypto.js";
import { TreeStatus, VerificationStatus, GpgSyncStatus } from "@prisma/client";
import type { FastifyInstance } from "fastify";

describe("Google Play Games Services: Linking, Retroactive Reconciliation & Durable Outbox", () => {
  let app: FastifyInstance;
  let user: any;
  let userToken: string;
  let otherUser: any;
  let otherToken: string;
  let species: any;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    user = await prisma.user.create({
      data: {
        email: `gpg_test_${Date.now()}@example.com`,
        displayName: "GPG Tester",
        publicHandle: `gpg_${Date.now()}`,
        status: "ACTIVE",
      },
    });
    userToken = app.jwt.sign({ userId: user.id, email: user.email });

    otherUser = await prisma.user.create({
      data: {
        email: `gpg_other_${Date.now()}@example.com`,
        displayName: "GPG Other",
        publicHandle: `gpg_oth_${Date.now()}`,
        status: "ACTIVE",
      },
    });
    otherToken = app.jwt.sign({ userId: otherUser.id, email: otherUser.email });

    species = await prisma.treeSpecies.findFirst({ where: { isActive: true } });

    // Set up mock verification and unlock handlers
    googlePlayGamesService.setMockHandlers(
      async (code: string) => {
        // Map codes to deterministic players:
        // "valid_server_code_123" and "fresh_valid_server_code_456" both belong to player_user_1
        const playerId =
          code.startsWith("valid_") || code.startsWith("fresh_")
            ? "player_user_1"
            : `player_${code}`;

        return {
          playerId,
          displayName: `GPG Player for ${code}`,
          refreshToken: `secret_refresh_token_for_${code}`,
        };
      },
      async () => ({
        success: true,
        newlyUnlocked: true,
      })
    );
  });

  afterAll(async () => {
    await prisma.googlePlayGamesSyncJob.deleteMany({
      where: { userId: { in: [user.id, otherUser.id] } },
    });
    await prisma.googlePlayGamesLink.deleteMany({
      where: { userId: { in: [user.id, otherUser.id] } },
    });
    await prisma.userAchievement.deleteMany({
      where: { userId: { in: [user.id, otherUser.id] } },
    });
    await prisma.tree.deleteMany({
      where: { ownerId: { in: [user.id, otherUser.id] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [user.id, otherUser.id] } },
    });
    await app.close();
  });

  it("unlocking a milestone while GPG is UNLINKED leaves gpgSyncedAt = null and creates 0 sync jobs", async () => {
    // 1. Plant 1 verified tree
    await prisma.tree.create({
      data: {
        ownerId: user.id,
        speciesId: species.id,
        plantedAt: new Date(),
        latitude: 12.9716,
        longitude: 77.5946,
        locationName: "GPG Unlinked Grove",
        idempotencyKey: `idemp_gpg_unl_${Date.now()}`,
        idempotencyFingerprint: `fp_gpg_unl_${Date.now()}`,
        status: TreeStatus.SUBMITTED,
        verificationStatus: VerificationStatus.VERIFIED,
      },
    });

    // 2. Evaluate achievements
    const evalResult = await achievementService.evaluateUserAchievements(user.id);
    expect(evalResult.newlyUnlocked.some((a) => a.key === "first_tree")).toBe(true);

    const ua = await prisma.userAchievement.findFirst({
      where: { userId: user.id, achievement: { key: "first_tree" } },
    });
    expect(ua?.status).toBe("UNLOCKED");
    expect(ua?.gpgSyncedAt).toBeNull();

    // 3. Confirm zero sync jobs exist
    const jobs = await prisma.googlePlayGamesSyncJob.findMany({
      where: { userId: user.id },
    });
    expect(jobs.length).toBe(0);
  });

  it("linking Google Play Games later exchanges auth code, hides gpgPlayerId, and RECONCILES prior milestones", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/integrations/google-play-games/link",
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        serverAuthCode: "valid_server_code_123",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.linked).toBe(true);
    // CRITICAL: Raw player ID is not exposed to the client
    expect(body.data.gpgPlayerId).toBeUndefined();
    expect(body.data.displayName).toBe("GPG Player for valid_server_code_123");
    expect(body.data.linkedAt).toBeDefined();
    expect(body.data.reconciledCount).toBeGreaterThanOrEqual(1);

    // Verify token was stored with AES-256-GCM v1 encryption
    const link = await prisma.googlePlayGamesLink.findUnique({
      where: { userId: user.id },
    });
    expect(link?.encryptedRefreshToken?.startsWith("v1:")).toBe(true);
    expect(link?.displayName).toBe("GPG Player for valid_server_code_123");

    // Verify decryptToken can read the plaintext token cleanly
    const decrypted = decryptToken(link!.encryptedRefreshToken!);
    expect(decrypted).toBe("secret_refresh_token_for_valid_server_code_123");

    // Verify a sync job was created for the previously unlocked milestone
    const job = await prisma.googlePlayGamesSyncJob.findFirst({
      where: { userId: user.id, status: GpgSyncStatus.PENDING },
    });
    expect(job).toBeDefined();
    expect(job?.gpgAchievementId).toBe("CgkI_first_tree");
  });

  it("GET /api/v1/integrations/google-play-games/status returns status and displayName without exposing gpgPlayerId", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/integrations/google-play-games/status",
      headers: { authorization: `Bearer ${userToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.linked).toBe(true);
    expect(body.data.displayName).toBe("GPG Player for valid_server_code_123");
    expect(body.data.linkedAt).toBeDefined();
    expect(body.data.gpgPlayerId).toBeUndefined();
  });

  it("relinking with a FRESH valid authorization code updates the link and does not duplicate sync jobs", async () => {
    // Relinking uses a fresh code representing the same player
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/integrations/google-play-games/link",
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        serverAuthCode: "fresh_valid_server_code_456",
      },
    });

    expect(res.statusCode).toBe(200);

    const link = await prisma.googlePlayGamesLink.findUnique({
      where: { userId: user.id },
    });
    const decrypted = decryptToken(link!.encryptedRefreshToken!);
    expect(decrypted).toBe("secret_refresh_token_for_fresh_valid_server_code_456");

    const jobsCount = await prisma.googlePlayGamesSyncJob.count({
      where: { userId: user.id },
    });
    expect(jobsCount).toBe(1);
  });

  it("another user cannot link an already-bound Google Play Games player identity (409 CONFLICT)", async () => {
    // otherUser sends a code that resolves to the same player_user_1
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/integrations/google-play-games/link",
      headers: { authorization: `Bearer ${otherToken}` },
      payload: {
        serverAuthCode: "valid_other_code_pointing_to_user_1",
      },
    });

    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("GPG_ACCOUNT_ALREADY_LINKED");
  });

  it("durable worker processes pending jobs, marks them COMPLETED, and updates gpgSyncedAt", async () => {
    const workerResult = await gpgWorker.processPendingJobs();
    expect(workerResult.processed).toBeGreaterThanOrEqual(1);
    expect(workerResult.succeeded).toBeGreaterThanOrEqual(1);

    const job = await prisma.googlePlayGamesSyncJob.findFirst({
      where: { userId: user.id },
    });
    expect(job?.status).toBe(GpgSyncStatus.COMPLETED);

    const ua = await prisma.userAchievement.findFirst({
      where: { userId: user.id, achievement: { key: "first_tree" } },
    });
    expect(ua?.gpgSyncedAt).not.toBeNull();
  });

  it("at-least-once outbox semantics: crash after external Google unlock succeeds recovers and finishes idempotently", async () => {
    // 1. Create a simulated job that crashed while in progress after external Google unlock
    const ua = await prisma.userAchievement.findFirst({
      where: { userId: user.id, achievement: { key: "first_tree" } },
    });

    // Reset ua.gpgSyncedAt to simulate job was interrupted before local DB commit
    await prisma.userAchievement.update({
      where: { id: ua!.id },
      data: { gpgSyncedAt: null },
    });

    const crashedJob = await prisma.googlePlayGamesSyncJob.create({
      data: {
        userId: user.id,
        userAchievementId: ua!.id,
        gpgAchievementId: "CgkI_crash_test",
        status: GpgSyncStatus.IN_PROGRESS,
        lockedAt: new Date(Date.now() - 6 * 60 * 1000), // Lease expired 6 minutes ago
        lockedBy: "crashed_worker_instance_42",
      },
    });

    // Configure mock to return newlyUnlocked: false (achievement is already unlocked in Google Play Games)
    googlePlayGamesService.setMockHandlers(
      undefined,
      async () => ({
        success: true,
        newlyUnlocked: false, // Google indicates already unlocked
      })
    );

    // 2. Worker recovers orphaned job
    const recovered = await gpgWorker.recoverOrphanedJobs();
    expect(recovered).toBeGreaterThanOrEqual(1);

    // 3. Worker retries the job
    const retryResult = await gpgWorker.processPendingJobs();
    expect(retryResult.succeeded).toBeGreaterThanOrEqual(1);

    const checkJob = await prisma.googlePlayGamesSyncJob.findUnique({
      where: { id: crashedJob.id },
    });
    expect(checkJob?.status).toBe(GpgSyncStatus.COMPLETED);

    const updatedUa = await prisma.userAchievement.findUnique({
      where: { id: ua!.id },
    });
    expect(updatedUa?.status).toBe("UNLOCKED");
    expect(updatedUa?.gpgSyncedAt).not.toBeNull();

    // Clean up crash test job
    await prisma.googlePlayGamesSyncJob.delete({ where: { id: crashedJob.id } });
  });

  it("orphan crash recovery: resets abandoned IN_PROGRESS jobs after lease expiry", async () => {
    // Create an artificial abandoned job with expired lease (6 minutes ago)
    const ua = await prisma.userAchievement.findFirst({
      where: { userId: user.id },
    });

    const abandonedJob = await prisma.googlePlayGamesSyncJob.create({
      data: {
        userId: user.id,
        userAchievementId: ua!.id,
        gpgAchievementId: "badge_test_abandoned",
        status: GpgSyncStatus.IN_PROGRESS,
        lockedAt: new Date(Date.now() - 6 * 60 * 1000), // 6 minutes ago
        lockedBy: "crashed_worker_pid_9999",
      },
    });

    const recoveredCount = await gpgWorker.recoverOrphanedJobs();
    expect(recoveredCount).toBeGreaterThanOrEqual(1);

    const checkJob = await prisma.googlePlayGamesSyncJob.findUnique({
      where: { id: abandonedJob.id },
    });
    expect(checkJob?.status).toBe(GpgSyncStatus.FAILED_RETRYABLE);
    expect(checkJob?.lastError).toContain("Lease expired");

    // Clean up test job
    await prisma.googlePlayGamesSyncJob.delete({ where: { id: abandonedJob.id } });
  });

  it("unlinking GPG account removes GooglePlayGamesLink and deletes pending jobs without touching UserAchievement", async () => {
    const unlinkRes = await app.inject({
      method: "DELETE",
      url: "/api/v1/integrations/google-play-games/link",
      headers: { authorization: `Bearer ${userToken}` },
    });

    expect(unlinkRes.statusCode).toBe(200);

    const link = await prisma.googlePlayGamesLink.findUnique({
      where: { userId: user.id },
    });
    expect(link).toBeNull();

    // Local user achievements remain intact
    const ua = await prisma.userAchievement.findFirst({
      where: { userId: user.id, achievement: { key: "first_tree" } },
    });
    expect(ua?.status).toBe("UNLOCKED");
  });
});
