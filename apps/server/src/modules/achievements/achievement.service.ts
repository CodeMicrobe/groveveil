import {
  Prisma,
  TreeStatus,
  VerificationStatus,
  AchievementStatus,
  GpgSyncStatus,
} from "@prisma/client";
import { prisma } from "../../shared/database/prisma.js";

export interface NextMilestoneDTO {
  id: string;
  key: string;
  name: string;
  description: string;
  targetValue: number;
  currentProgress: number;
  remainingTrees: number;
}

export interface AchievementItemDTO {
  id: string;
  key: string;
  name: string;
  description: string;
  category: string;
  criteriaType: string;
  targetValue: number;
  progress: number;
  status: "LOCKED" | "IN_PROGRESS" | "UNLOCKED";
  unlockedAt: string | null;
  gpgSynced: boolean;
}

export interface UserAchievementsResponseDTO {
  currentVerifiedTreeCount: number;
  distinctSpeciesCount: number;
  nextMilestone: NextMilestoneDTO | null;
  achievements: AchievementItemDTO[];
}

export class AchievementService {
  /**
   * Calculates derived verified tree count and distinct species count
   * strictly from database state where verificationStatus is VERIFIED and status != REMOVED.
   */
  public async getDerivedMetrics(
    userId: string,
    client: Prisma.TransactionClient | typeof prisma = prisma
  ) {
    const verifiedTreeCount = await client.tree.count({
      where: {
        ownerId: userId,
        verificationStatus: VerificationStatus.VERIFIED,
        status: { not: TreeStatus.REMOVED },
      },
    });

    const distinctSpecies = await client.tree.findMany({
      where: {
        ownerId: userId,
        verificationStatus: VerificationStatus.VERIFIED,
        status: { not: TreeStatus.REMOVED },
      },
      select: { speciesId: true },
      distinct: ["speciesId"],
    });

    return {
      verifiedTreeCount,
      distinctSpeciesCount: distinctSpecies.length,
    };
  }

  /**
   * Authoritatively evaluates user achievements within an optional transaction.
   * Idempotent: already UNLOCKED achievements remain untouched with original unlockedAt.
   * Dispatches durable GpgSyncJob if Google Play Games is linked.
   */
  public async evaluateUserAchievements(
    userId: string,
    client: Prisma.TransactionClient | typeof prisma = prisma
  ) {
    const { verifiedTreeCount, distinctSpeciesCount } =
      await this.getDerivedMetrics(userId, client);

    const definitions = await client.achievementDefinition.findMany({
      where: { isActive: true },
      orderBy: { targetValue: "asc" },
    });

    const existingUserAchievements = await client.userAchievement.findMany({
      where: { userId },
    });

    const achievementMap = new Map<string, (typeof existingUserAchievements)[0]>();
    for (const ua of existingUserAchievements) {
      achievementMap.set(ua.achievementId, ua);
    }

    const gpgLink = await client.googlePlayGamesLink.findUnique({
      where: { userId },
    });

    const newlyUnlocked: Array<{ id: string; key: string; name: string }> = [];

    for (const def of definitions) {
      const currentMetric =
        def.criteriaType === "DISTINCT_SPECIES_COUNT"
          ? distinctSpeciesCount
          : verifiedTreeCount;

      const isEligible = currentMetric >= def.targetValue;
      const existing = achievementMap.get(def.id);

      if (existing && existing.status === AchievementStatus.UNLOCKED) {
        // Already unlocked: preserve permanent historical record & timestamp
        continue;
      }

      if (isEligible) {
        // Unlock milestone atomically
        const unlockedAt = new Date();
        const userAch = await client.userAchievement.upsert({
          where: {
            userId_achievementId: {
              userId,
              achievementId: def.id,
            },
          },
          update: {
            status: AchievementStatus.UNLOCKED,
            progress: def.targetValue,
            unlockedAt,
          },
          create: {
            userId,
            achievementId: def.id,
            status: AchievementStatus.UNLOCKED,
            progress: def.targetValue,
            unlockedAt,
          },
        });

        // If user is linked to Google Play Games and achievement has a gpgId,
        // create a durable sync outbox job in the same transaction
        if (gpgLink && def.gpgId) {
          await client.googlePlayGamesSyncJob.upsert({
            where: {
              userAchievementId_gpgAchievementId: {
                userAchievementId: userAch.id,
                gpgAchievementId: def.gpgId,
              },
            },
            update: {},
            create: {
              userId,
              userAchievementId: userAch.id,
              gpgAchievementId: def.gpgId,
              status: GpgSyncStatus.PENDING,
              nextAttemptAt: new Date(),
            },
          });
        }

        // Audit Log
        await client.auditLog.create({
          data: {
            userId,
            action: "ACHIEVEMENT_UNLOCKED",
            details: JSON.stringify({
              achievementId: def.id,
              achievementKey: def.key,
              targetValue: def.targetValue,
              verifiedTreeCount,
              distinctSpeciesCount,
            }),
          },
        });

        newlyUnlocked.push({ id: def.id, key: def.key, name: def.name });
      }
    }

    return {
      verifiedTreeCount,
      distinctSpeciesCount,
      newlyUnlocked,
    };
  }

  /**
   * Retrieves user achievements cleanly separating permanent historical unlocks
   * from current in-progress fractions to prevent UI contradictions.
   */
  public async getUserAchievements(userId: string): Promise<UserAchievementsResponseDTO> {
    const { verifiedTreeCount, distinctSpeciesCount } =
      await this.getDerivedMetrics(userId);

    const definitions = await prisma.achievementDefinition.findMany({
      where: { isActive: true },
      orderBy: { targetValue: "asc" },
    });

    const userAchievements = await prisma.userAchievement.findMany({
      where: { userId },
    });

    const achievementMap = new Map<string, (typeof userAchievements)[0]>();
    for (const ua of userAchievements) {
      achievementMap.set(ua.achievementId, ua);
    }

    let nextMilestone: NextMilestoneDTO | null = null;

    const achievements: AchievementItemDTO[] = definitions.map((def) => {
      const ua = achievementMap.get(def.id);
      const isTreeCountCriteria = def.criteriaType === "VERIFIED_TREE_COUNT";
      const currentMetric = isTreeCountCriteria
        ? verifiedTreeCount
        : distinctSpeciesCount;

      if (ua && ua.status === AchievementStatus.UNLOCKED) {
        return {
          id: def.id,
          key: def.key,
          name: def.name,
          description: def.description,
          category: def.category,
          criteriaType: def.criteriaType,
          targetValue: def.targetValue,
          progress: def.targetValue, // Unlocked always matches complete target
          status: "UNLOCKED",
          unlockedAt: ua.unlockedAt ? ua.unlockedAt.toISOString() : null,
          gpgSynced: !!ua.gpgSyncedAt,
        };
      }

      // Incomplete or locked
      const progress = Math.min(currentMetric, def.targetValue);
      const status = progress > 0 ? "IN_PROGRESS" : "LOCKED";

      // Track the next milestone for primary tree milestones
      if (isTreeCountCriteria && !nextMilestone && def.targetValue > verifiedTreeCount) {
        nextMilestone = {
          id: def.id,
          key: def.key,
          name: def.name,
          description: def.description,
          targetValue: def.targetValue,
          currentProgress: verifiedTreeCount,
          remainingTrees: def.targetValue - verifiedTreeCount,
        };
      }

      return {
        id: def.id,
        key: def.key,
        name: def.name,
        description: def.description,
        category: def.category,
        criteriaType: def.criteriaType,
        targetValue: def.targetValue,
        progress,
        status,
        unlockedAt: null,
        gpgSynced: false,
      };
    });

    return {
      currentVerifiedTreeCount: verifiedTreeCount,
      distinctSpeciesCount,
      nextMilestone,
      achievements,
    };
  }
}

export const achievementService = new AchievementService();
