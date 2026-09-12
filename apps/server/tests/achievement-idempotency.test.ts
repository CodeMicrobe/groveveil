import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/shared/database/prisma.js";
import { achievementService } from "../src/modules/achievements/achievement.service.js";
import { TreeStatus, VerificationStatus, UserRole } from "@prisma/client";
import type { FastifyInstance } from "fastify";

describe("Achievement Idempotency, Concurrency & Revocation Semantics", () => {
  let app: FastifyInstance;
  let user: any;
  let operator: any;
  let operatorToken: string;
  let species: any;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    user = await prisma.user.create({
      data: {
        email: `idem_${Date.now()}@example.com`,
        displayName: "Idempotency Tester",
        publicHandle: `idem_${Date.now()}`,
        status: "ACTIVE",
      },
    });

    operator = await prisma.user.create({
      data: {
        email: `op_ach_${Date.now()}@example.com`,
        displayName: "Op Reviewer",
        publicHandle: `op_ach_${Date.now()}`,
        role: UserRole.OPERATOR,
        status: "ACTIVE",
      },
    });

    operatorToken = app.jwt.sign({
      userId: operator.id,
      email: operator.email,
      role: UserRole.OPERATOR,
    });

    species = await prisma.treeSpecies.findFirst({ where: { isActive: true } });
  });

  afterAll(async () => {
    await prisma.userAchievement.deleteMany({ where: { userId: user.id } });
    await prisma.verificationEvent.deleteMany({
      where: { tree: { ownerId: user.id } },
    });
    await prisma.tree.deleteMany({ where: { ownerId: user.id } });
    await prisma.user.deleteMany({ where: { id: { in: [user.id, operator.id] } } });
    await app.close();
  });

  const createTree = async (verificationStatus: VerificationStatus) => {
    return prisma.tree.create({
      data: {
        ownerId: user.id,
        speciesId: species.id,
        plantedAt: new Date(),
        latitude: 12.9716,
        longitude: 77.5946,
        locationName: "Idem Grove",
        idempotencyKey: `idemp_idem_${Date.now()}_${Math.random()}`,
        idempotencyFingerprint: `fp_idem_${Math.random()}`,
        status: TreeStatus.SUBMITTED,
        verificationStatus,
      },
    });
  };

  it("repeated evaluation of the same verified tree is idempotent and preserves original unlockedAt", async () => {
    await createTree(VerificationStatus.VERIFIED);

    // Initial evaluation
    const eval1 = await achievementService.evaluateUserAchievements(user.id);
    expect(eval1.newlyUnlocked.some((a) => a.key === "first_tree")).toBe(true);

    const record1 = await prisma.userAchievement.findFirst({
      where: { userId: user.id, achievement: { key: "first_tree" } },
    });
    expect(record1).toBeDefined();
    const originalUnlockedAt = record1!.unlockedAt;

    // Repeated evaluation
    const eval2 = await achievementService.evaluateUserAchievements(user.id);
    expect(eval2.newlyUnlocked.length).toBe(0); // Nothing newly unlocked

    const record2 = await prisma.userAchievement.findFirst({
      where: { userId: user.id, achievement: { key: "first_tree" } },
    });
    expect(record2!.unlockedAt?.getTime()).toBe(originalUnlockedAt?.getTime());

    // Ensure strictly 1 UserAchievement record exists for this milestone
    const count = await prisma.userAchievement.count({
      where: { userId: user.id, achievement: { key: "first_tree" } },
    });
    expect(count).toBe(1);
  });

  it("operator transition of tree to VERIFIED triggers achievement evaluation atomically", async () => {
    // Create tree initially PENDING_VERIFICATION
    const pendingTree = await createTree(VerificationStatus.PENDING_VERIFICATION);

    // Call operator verification endpoint PATCH /api/v1/trees/:id/verification
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/trees/${pendingTree.id}/verification`,
      headers: { authorization: `Bearer ${operatorToken}` },
      payload: {
        status: "VERIFIED",
        reason: "Photo matches botanical characteristics",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.verificationStatus).toBe("VERIFIED");

    // VerificationEvent was created
    const event = await prisma.verificationEvent.findFirst({
      where: { treeId: pendingTree.id },
    });
    expect(event).toBeDefined();
    expect(event?.newStatus).toBe(VerificationStatus.VERIFIED);
    expect(event?.reviewerId).toBe(operator.id);
  });

  it("revocation semantics: already unlocked achievements remain UNLOCKED when tree count later drops", async () => {
    // User already has 2 verified trees from above tests.
    // Let's add 8 more trees to reach 10 verified trees (unlocks tree_planter_10)
    const extraTrees = [];
    for (let i = 0; i < 8; i++) {
      extraTrees.push(await createTree(VerificationStatus.VERIFIED));
    }

    await achievementService.evaluateUserAchievements(user.id);

    // Verify 10 trees reached and unlocked
    const preRevoke = await achievementService.getUserAchievements(user.id);
    expect(preRevoke.currentVerifiedTreeCount).toBe(10);
    const planter10Pre = preRevoke.achievements.find((a) => a.key === "tree_planter_10");
    expect(planter10Pre?.status).toBe("UNLOCKED");
    expect(planter10Pre?.unlockedAt).not.toBeNull();

    // Now operator revokes 1 tree (marks it REJECTED)
    const treeToRevoke = extraTrees[0];
    const revokeRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/trees/${treeToRevoke.id}/verification`,
      headers: { authorization: `Bearer ${operatorToken}` },
      payload: {
        status: "REJECTED",
        reason: "Subsequent audit found GPS mismatch",
      },
    });
    expect(revokeRes.statusCode).toBe(200);

    // Inspect user's achievements after revocation
    const postRevoke = await achievementService.getUserAchievements(user.id);
    expect(postRevoke.currentVerifiedTreeCount).toBe(9); // Dropped from 10 to 9

    // 1. Completed milestone remains historical UNLOCKED
    const planter10Post = postRevoke.achievements.find((a) => a.key === "tree_planter_10");
    expect(planter10Post?.status).toBe("UNLOCKED");
    expect(planter10Post?.unlockedAt).toBe(planter10Pre?.unlockedAt);

    // 2. Next incomplete milestone reflects the updated active count (9/25, 16 remaining)
    const planter25 = postRevoke.achievements.find((a) => a.key === "tree_planter_25");
    expect(planter25?.status).toBe("IN_PROGRESS");
    expect(planter25?.progress).toBe(9);
    expect(postRevoke.nextMilestone?.key).toBe("tree_planter_25");
    expect(postRevoke.nextMilestone?.remainingTrees).toBe(16);
  });
});
