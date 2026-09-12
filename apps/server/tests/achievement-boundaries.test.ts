import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/shared/database/prisma.js";
import { achievementService } from "../src/modules/achievements/achievement.service.js";
import { TreeStatus, VerificationStatus } from "@prisma/client";
import type { FastifyInstance } from "fastify";

describe("Achievement Threshold Boundaries (0, 1, 9, 10, 24, 25)", () => {
  let app: FastifyInstance;
  let user: any;
  let species: any;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    user = await prisma.user.create({
      data: {
        email: `bound_${Date.now()}@example.com`,
        displayName: "Boundary Tester",
        publicHandle: `bound_${Date.now()}`,
        status: "ACTIVE",
      },
    });

    species = await prisma.treeSpecies.findFirst({ where: { isActive: true } });
  });

  afterAll(async () => {
    await prisma.userAchievement.deleteMany({ where: { userId: user.id } });
    await prisma.tree.deleteMany({ where: { ownerId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
    await app.close();
  });

  const createVerifiedTree = async () => {
    return prisma.tree.create({
      data: {
        ownerId: user.id,
        speciesId: species.id,
        plantedAt: new Date(),
        latitude: 12.9716,
        longitude: 77.5946,
        locationName: "Test Grove",
        idempotencyKey: `idemp_tree_${Date.now()}_${Math.random()}`,
        idempotencyFingerprint: `fp_${Math.random()}`,
        status: TreeStatus.SUBMITTED,
        verificationStatus: VerificationStatus.VERIFIED,
      },
    });
  };

  it("at 0 verified trees: all milestones are LOCKED, next milestone is first_tree (1 tree remaining)", async () => {
    const res = await achievementService.getUserAchievements(user.id);
    expect(res.currentVerifiedTreeCount).toBe(0);

    const firstTree = res.achievements.find((a) => a.key === "first_tree");
    expect(firstTree?.status).toBe("LOCKED");
    expect(firstTree?.progress).toBe(0);

    const planter10 = res.achievements.find((a) => a.key === "tree_planter_10");
    expect(planter10?.status).toBe("LOCKED");
    expect(planter10?.progress).toBe(0);

    expect(res.nextMilestone).toBeDefined();
    expect(res.nextMilestone?.key).toBe("first_tree");
    expect(res.nextMilestone?.remainingTrees).toBe(1);
  });

  it("pending, rejected, and removed trees do NOT count toward verified progress", async () => {
    // 1. Pending tree
    await prisma.tree.create({
      data: {
        ownerId: user.id,
        speciesId: species.id,
        plantedAt: new Date(),
        latitude: 12.9716,
        longitude: 77.5946,
        locationName: "Pending Tree",
        idempotencyKey: `idemp_pend_${Date.now()}`,
        idempotencyFingerprint: `fp_pend_${Date.now()}`,
        status: TreeStatus.SUBMITTED,
        verificationStatus: VerificationStatus.PENDING_VERIFICATION,
      },
    });

    // 2. Rejected tree
    await prisma.tree.create({
      data: {
        ownerId: user.id,
        speciesId: species.id,
        plantedAt: new Date(),
        latitude: 12.9716,
        longitude: 77.5946,
        locationName: "Rejected Tree",
        idempotencyKey: `idemp_rej_${Date.now()}`,
        idempotencyFingerprint: `fp_rej_${Date.now()}`,
        status: TreeStatus.SUBMITTED,
        verificationStatus: VerificationStatus.REJECTED,
      },
    });

    // 3. Removed tree (even if marked verified)
    await prisma.tree.create({
      data: {
        ownerId: user.id,
        speciesId: species.id,
        plantedAt: new Date(),
        latitude: 12.9716,
        longitude: 77.5946,
        locationName: "Removed Tree",
        idempotencyKey: `idemp_rem_${Date.now()}`,
        idempotencyFingerprint: `fp_rem_${Date.now()}`,
        status: TreeStatus.REMOVED,
        verificationStatus: VerificationStatus.VERIFIED,
      },
    });

    const metrics = await achievementService.getDerivedMetrics(user.id);
    expect(metrics.verifiedTreeCount).toBe(0);
  });

  it("at 1 verified tree: first_tree unlocks, tree_planter_10 is IN_PROGRESS (1/10), next is tree_planter_10", async () => {
    await createVerifiedTree();
    await achievementService.evaluateUserAchievements(user.id);

    const res = await achievementService.getUserAchievements(user.id);
    expect(res.currentVerifiedTreeCount).toBe(1);

    const firstTree = res.achievements.find((a) => a.key === "first_tree");
    expect(firstTree?.status).toBe("UNLOCKED");
    expect(firstTree?.unlockedAt).not.toBeNull();
    expect(firstTree?.progress).toBe(1);

    const planter10 = res.achievements.find((a) => a.key === "tree_planter_10");
    expect(planter10?.status).toBe("IN_PROGRESS");
    expect(planter10?.progress).toBe(1);

    expect(res.nextMilestone?.key).toBe("tree_planter_10");
    expect(res.nextMilestone?.remainingTrees).toBe(9);
  });

  it("at 9 verified trees: tree_planter_10 remains IN_PROGRESS (9/10)", async () => {
    // Add 8 more verified trees (1 + 8 = 9)
    for (let i = 0; i < 8; i++) {
      await createVerifiedTree();
    }
    await achievementService.evaluateUserAchievements(user.id);

    const res = await achievementService.getUserAchievements(user.id);
    expect(res.currentVerifiedTreeCount).toBe(9);

    const planter10 = res.achievements.find((a) => a.key === "tree_planter_10");
    expect(planter10?.status).toBe("IN_PROGRESS");
    expect(planter10?.progress).toBe(9);
    expect(res.nextMilestone?.key).toBe("tree_planter_10");
    expect(res.nextMilestone?.remainingTrees).toBe(1);
  });

  it("at 10 verified trees: tree_planter_10 unlocks, tree_planter_25 is IN_PROGRESS (10/25), next is tree_planter_25", async () => {
    // Add 1 more verified tree (9 + 1 = 10)
    await createVerifiedTree();
    await achievementService.evaluateUserAchievements(user.id);

    const res = await achievementService.getUserAchievements(user.id);
    expect(res.currentVerifiedTreeCount).toBe(10);

    const planter10 = res.achievements.find((a) => a.key === "tree_planter_10");
    expect(planter10?.status).toBe("UNLOCKED");
    expect(planter10?.unlockedAt).not.toBeNull();
    expect(planter10?.progress).toBe(10);

    const planter25 = res.achievements.find((a) => a.key === "tree_planter_25");
    expect(planter25?.status).toBe("IN_PROGRESS");
    expect(planter25?.progress).toBe(10);

    expect(res.nextMilestone?.key).toBe("tree_planter_25");
    expect(res.nextMilestone?.remainingTrees).toBe(15);
  });

  it("at 24 verified trees: tree_planter_25 remains IN_PROGRESS (24/25)", async () => {
    // Add 14 more verified trees (10 + 14 = 24)
    for (let i = 0; i < 14; i++) {
      await createVerifiedTree();
    }
    await achievementService.evaluateUserAchievements(user.id);

    const res = await achievementService.getUserAchievements(user.id);
    expect(res.currentVerifiedTreeCount).toBe(24);

    const planter25 = res.achievements.find((a) => a.key === "tree_planter_25");
    expect(planter25?.status).toBe("IN_PROGRESS");
    expect(planter25?.progress).toBe(24);
    expect(res.nextMilestone?.key).toBe("tree_planter_25");
    expect(res.nextMilestone?.remainingTrees).toBe(1);
  });

  it("at 25 verified trees: tree_planter_25 unlocks, next is forest_builder_100 (75 trees remaining)", async () => {
    // Add 1 more verified tree (24 + 1 = 25)
    await createVerifiedTree();
    await achievementService.evaluateUserAchievements(user.id);

    const res = await achievementService.getUserAchievements(user.id);
    expect(res.currentVerifiedTreeCount).toBe(25);

    const planter25 = res.achievements.find((a) => a.key === "tree_planter_25");
    expect(planter25?.status).toBe("UNLOCKED");
    expect(planter25?.unlockedAt).not.toBeNull();
    expect(planter25?.progress).toBe(25);

    expect(res.nextMilestone?.key).toBe("forest_builder_100");
    expect(res.nextMilestone?.remainingTrees).toBe(75);
  });
});
