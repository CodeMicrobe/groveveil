import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/shared/database/prisma.js";
import { achievementService } from "../src/modules/achievements/achievement.service.js";
import { TreeStatus, VerificationStatus } from "@prisma/client";
import type { FastifyInstance } from "fastify";

describe("Achievement API Boundaries & Multi-Tenant Privacy", () => {
  let app: FastifyInstance;
  let userA: any;
  let userB: any;
  let userAToken: string;
  let userBToken: string;
  let species: any;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    userA = await prisma.user.create({
      data: {
        email: `api_a_${Date.now()}@example.com`,
        displayName: "User A",
        publicHandle: `api_a_${Date.now()}`,
        status: "ACTIVE",
      },
    });
    userAToken = app.jwt.sign({ userId: userA.id, email: userA.email });

    userB = await prisma.user.create({
      data: {
        email: `api_b_${Date.now()}@example.com`,
        displayName: "User B",
        publicHandle: `api_b_${Date.now()}`,
        status: "ACTIVE",
      },
    });
    userBToken = app.jwt.sign({ userId: userB.id, email: userB.email });

    species = await prisma.treeSpecies.findFirst({ where: { isActive: true } });

    // User A plants 1 verified tree (unlocks first_tree)
    await prisma.tree.create({
      data: {
        ownerId: userA.id,
        speciesId: species.id,
        plantedAt: new Date(),
        latitude: 12.9716,
        longitude: 77.5946,
        locationName: "User A Grove",
        idempotencyKey: `idemp_a_${Date.now()}`,
        idempotencyFingerprint: `fp_a_${Date.now()}`,
        status: TreeStatus.SUBMITTED,
        verificationStatus: VerificationStatus.VERIFIED,
      },
    });
    await achievementService.evaluateUserAchievements(userA.id);
  });

  afterAll(async () => {
    await prisma.userAchievement.deleteMany({
      where: { userId: { in: [userA.id, userB.id] } },
    });
    await prisma.tree.deleteMany({
      where: { ownerId: { in: [userA.id, userB.id] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [userA.id, userB.id] } },
    });
    await app.close();
  });

  it("GET /api/v1/achievements rejects unauthenticated requests with 401 UNAUTHORIZED", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/achievements",
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("GET /api/v1/achievements returns User A's unlocked first_tree and in-progress tree_planter_10", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/achievements",
      headers: { authorization: `Bearer ${userAToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);

    const data = body.data;
    expect(data.currentVerifiedTreeCount).toBe(1);
    expect(data.nextMilestone).toBeDefined();
    expect(data.nextMilestone.key).toBe("tree_planter_10");
    expect(data.nextMilestone.remainingTrees).toBe(9);

    const firstTree = data.achievements.find((a: any) => a.key === "first_tree");
    expect(firstTree.status).toBe("UNLOCKED");
    expect(firstTree.unlockedAt).not.toBeNull();

    const planter10 = data.achievements.find((a: any) => a.key === "tree_planter_10");
    expect(planter10.status).toBe("IN_PROGRESS");
    expect(planter10.progress).toBe(1);
  });

  it("User B's achievements are strictly isolated and show 0 trees and all locked milestones", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/achievements",
      headers: { authorization: `Bearer ${userBToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);

    const data = body.data;
    expect(data.currentVerifiedTreeCount).toBe(0);
    expect(data.nextMilestone.key).toBe("first_tree");

    const firstTree = data.achievements.find((a: any) => a.key === "first_tree");
    expect(firstTree.status).toBe("LOCKED");
    expect(firstTree.unlockedAt).toBeNull();
  });
});
