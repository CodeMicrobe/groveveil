import { prisma } from "../../shared/database/prisma.js";
import { GpgSyncStatus } from "@prisma/client";
import { encryptToken, decryptToken } from "./crypto.js";

export interface GpgLinkResponseDTO {
  linked: boolean;
  displayName?: string;
  linkedAt?: string;
  reconciledCount: number;
}

export interface GpgStatusResponseDTO {
  linked: boolean;
  displayName?: string;
  linkedAt?: string;
}

export class GooglePlayGamesService {
  private mockVerificationHandler?: (
    code: string
  ) => Promise<{ playerId: string; displayName: string; refreshToken: string }>;

  private mockUnlockHandler?: (
    playerId: string,
    achievementId: string,
    refreshToken: string
  ) => Promise<{ success: boolean; newlyUnlocked: boolean }>;

  /**
   * For test isolation: permits mocking external Google endpoints.
   */
  public setMockHandlers(
    verifyHandler?: typeof this.mockVerificationHandler,
    unlockHandler?: typeof this.mockUnlockHandler
  ) {
    this.mockVerificationHandler = verifyHandler;
    this.mockUnlockHandler = unlockHandler;
  }

  /**
   * Authoritative server exchange of Android PGS v2 server authorization code.
   * Proves identity, encrypts refresh token, and executes retroactive reconciliation.
   */
  public async linkAccount(
    userId: string,
    serverAuthCode: string
  ): Promise<GpgLinkResponseDTO> {
    if (!serverAuthCode || serverAuthCode.trim().length === 0) {
      const err = new Error("Valid Google Play Games server authorization code is required");
      (err as any).statusCode = 400;
      (err as any).code = "INVALID_AUTH_CODE";
      throw err;
    }

    let playerId: string;
    let displayName: string;
    let refreshToken: string;

    if (this.mockVerificationHandler) {
      const verified = await this.mockVerificationHandler(serverAuthCode);
      playerId = verified.playerId;
      displayName = verified.displayName;
      refreshToken = verified.refreshToken;
    } else {
      // Production Google OAuth Token Exchange
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        // Fallback test/dev identity derivation when live credentials are not set
        playerId = `mock_gpg_${serverAuthCode.slice(0, 12)}`;
        displayName = "Play Games Planter";
        refreshToken = `mock_refresh_${Date.now()}`;
      } else {
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code: serverAuthCode,
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: "authorization_code",
          }),
        });

        if (!tokenRes.ok) {
          const err = new Error("Failed to verify authorization code with Google");
          (err as any).statusCode = 400;
          (err as any).code = "GOOGLE_AUTH_FAILED";
          throw err;
        }

        const tokenData = (await tokenRes.json()) as any;
        const accessToken = tokenData.access_token;
        refreshToken = tokenData.refresh_token || `retained_${Date.now()}`;

        // Call PGS REST API to obtain authoritative verified player ID
        const playerRes = await fetch(
          "https://games.googleapis.com/games/v1/players/me",
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        if (!playerRes.ok) {
          const err = new Error("Failed to retrieve player identity from Google Play Games");
          (err as any).statusCode = 400;
          (err as any).code = "GPG_PROFILE_FAILED";
          throw err;
        }

        const playerData = (await playerRes.json()) as any;
        playerId = playerData.playerId;
        displayName = playerData.displayName || "Tree Champion";
      }
    }

    // Ensure playerId is not already bound to another Groveveil user
    const existingOther = await prisma.googlePlayGamesLink.findFirst({
      where: {
        gpgPlayerId: playerId,
        userId: { not: userId },
      },
    });

    if (existingOther) {
      const err = new Error("This Google Play Games identity is already linked to another account");
      (err as any).statusCode = 409;
      (err as any).code = "GPG_ACCOUNT_ALREADY_LINKED";
      throw err;
    }

    const encryptedRefreshToken = encryptToken(refreshToken);

    // Save link in transaction and execute retroactive reconciliation
    const result = await prisma.$transaction(async (tx) => {
      await tx.googlePlayGamesLink.upsert({
        where: { userId },
        update: {
          gpgPlayerId: playerId,
          displayName,
          encryptedRefreshToken,
        },
        create: {
          userId,
          gpgPlayerId: playerId,
          displayName,
          encryptedRefreshToken,
        },
      });

      // Retroactive Reconciliation Step:
      // Discover existing UNLOCKED milestones with missing gpgSyncedAt
      const unsyncedAchievements = await tx.userAchievement.findMany({
        where: {
          userId,
          status: "UNLOCKED",
          gpgSyncedAt: null,
          achievement: {
            gpgId: { not: null },
          },
        },
        include: { achievement: true },
      });

      let reconciledCount = 0;
      for (const ua of unsyncedAchievements) {
        if (ua.achievement.gpgId) {
          await tx.googlePlayGamesSyncJob.upsert({
            where: {
              userAchievementId_gpgAchievementId: {
                userAchievementId: ua.id,
                gpgAchievementId: ua.achievement.gpgId,
              },
            },
            update: {},
            create: {
              userId,
              userAchievementId: ua.id,
              gpgAchievementId: ua.achievement.gpgId,
              status: GpgSyncStatus.PENDING,
              nextAttemptAt: new Date(),
            },
          });
          reconciledCount++;
        }
      }

      await tx.auditLog.create({
        data: {
          userId,
          action: "GPG_ACCOUNT_LINKED",
          details: JSON.stringify({ gpgPlayerId: playerId, reconciledCount }),
        },
      });

      return { reconciledCount };
    });

    return {
      linked: true,
      displayName,
      linkedAt: new Date().toISOString(),
      reconciledCount: result.reconciledCount,
    };
  }

  /**
   * Unlinks Google Play Games account and cancels any pending sync jobs.
   */
  public async unlinkAccount(userId: string) {
    const existing = await prisma.googlePlayGamesLink.findUnique({
      where: { userId },
    });

    if (!existing) {
      return { unlinked: false, message: "No Google Play Games account linked" };
    }

    // Attempt token revocation if refresh token exists
    if (existing.encryptedRefreshToken) {
      try {
        const rawToken = decryptToken(existing.encryptedRefreshToken);
        await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(rawToken)}`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        }).catch(() => {});
      } catch {
        // Safe swallow
      }
    }

    await prisma.$transaction(async (tx) => {
      // Remove link
      await tx.googlePlayGamesLink.deleteMany({
        where: { userId },
      });

      // Cancel pending or retryable sync jobs
      await tx.googlePlayGamesSyncJob.deleteMany({
        where: {
          userId,
          status: { in: [GpgSyncStatus.PENDING, GpgSyncStatus.FAILED_RETRYABLE] },
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: "GPG_ACCOUNT_UNLINKED",
          details: JSON.stringify({ gpgPlayerId: existing.gpgPlayerId }),
        },
      });
    });

    return { unlinked: true };
  }

  /**
   * Returns current Google Play Games connection status for the authenticated user.
   */
  public async getStatus(userId: string): Promise<GpgStatusResponseDTO> {
    const link = await prisma.googlePlayGamesLink.findUnique({
      where: { userId },
    });

    if (!link) {
      return { linked: false };
    }

    return {
      linked: true,
      displayName: link.displayName || undefined,
      linkedAt: link.linkedAt.toISOString(),
    };
  }

  /**
   * Dispatches an external unlock call to Google Play Games Services.
   */
  public async unlockExternalAchievement(
    playerId: string,
    gpgAchievementId: string,
    encryptedRefreshToken: string
  ): Promise<{ success: boolean; newlyUnlocked: boolean }> {
    const rawRefreshToken = decryptToken(encryptedRefreshToken);

    if (this.mockUnlockHandler) {
      return this.mockUnlockHandler(playerId, gpgAchievementId, rawRefreshToken);
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      // In development/test mode without credentials, treat as successful mock sync
      return { success: true, newlyUnlocked: true };
    }

    // Refresh access token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: rawRefreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!tokenRes.ok) {
      const err = new Error("Failed to refresh Google access token");
      (err as any).statusCode = tokenRes.status;
      (err as any).isAuthRevoked = tokenRes.status === 400 || tokenRes.status === 401;
      throw err;
    }

    const tokenData = (await tokenRes.json()) as any;
    const accessToken = tokenData.access_token;

    // Call Google Play Games unlock API
    const unlockRes = await fetch(
      `https://games.googleapis.com/games/v1/achievements/${encodeURIComponent(gpgAchievementId)}/unlock`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!unlockRes.ok) {
      const err = new Error(`Google Play Games unlock API failed with status ${unlockRes.status}`);
      (err as any).statusCode = unlockRes.status;
      throw err;
    }

    const unlockData = (await unlockRes.json()) as any;
    return {
      success: true,
      newlyUnlocked: unlockData.newlyUnlocked ?? false,
    };
  }
}

export const googlePlayGamesService = new GooglePlayGamesService();
