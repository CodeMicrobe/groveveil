import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/shared/database/prisma.js";
import { achievementService } from "../src/modules/achievements/achievement.service.js";
import { TreeStatus, VerificationStatus } from "@prisma/client";
import type { FastifyInstance } from "fastify";

describe("Achievement Biodiversity & Species Milestones", () => {
  let app: FastifyInstance;
  let user: any;
  let allSpecies: any[];

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    user = await prisma.user.create({
      data: {
        email: `bio_${Date.now()}@example.com`,
        displayName: "Bio Tester",
        publicHandle: `bio_${Date.now()}`,
        status: "ACTIVE",
      },
    });

    allSpecies = await prisma.treeSpecies.findMany({
      where: { isActive: true },
      take: 5,
    });
  });

  afterAll(async () => {
    await prisma.userAchievement.deleteMany({ where: { userId: user.id } });
    await prisma.tree.deleteMany({ where: { ownerId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
    await app.close();
  });

  const plantVerifiedTreeWithSpecies = async (speciesId: string) => {
    return prisma.tree.create({
      data: {
        ownerId: user.id,
        speciesId,
        plantedAt: new Date(),
        latitude: 12.9716,
        longitude: 77.5946,
        locationName: "Bio Grove",
        idempotencyKey: `idemp_bio_${Date.now()}_${Math.random()}`,
        idempotencyFingerprint: `fp_bio_${Math.random()}`,
        status: TreeStatus.SUBMITTED,
        verificationStatus: VerificationStatus.VERIFIED,
      },
    });
  };

  it("at 0 species: biodiversity_5 is LOCKED (0/5)", async () => {
    const res = await achievementService.getUserAchievements(user.id);
    expect(res.distinctSpeciesCount).toBe(0);

    const bio = res.achievements.find((a) => a.key === "biodiversity_5");
    expect(bio?.status).toBe("LOCKED");
    expect(bio?.progress).toBe(0);
  });

  it("planting multiple trees of the SAME species yields 1 distinct species (1/5, IN_PROGRESS)", async () => {
    // Plant 3 trees of species[0]
    await plantVerifiedTreeWithSpecies(allSpecies[0].id);
    await plantVerifiedTreeWithSpecies(allSpecies[0].id);
    await plantVerifiedTreeWithSpecies(allSpecies[0].id);

    await achievementService.evaluateUserAchievements(user.id);

    const res = await achievementService.getUserAchievements(user.id);
    expect(res.currentVerifiedTreeCount).toBe(3);
    expect(res.distinctSpeciesCount).toBe(1);

    const bio = res.achievements.find((a) => a.key === "biodiversity_5");
    expect(bio?.status).toBe("IN_PROGRESS");
    expect(bio?.progress).toBe(1);
  });

  it("at 4 distinct species: biodiversity_5 remains IN_PROGRESS (4/5)", async () => {
    // Add trees for species[1], species[2], species[3]
    await plantVerifiedTreeWithSpecies(allSpecies[1].id);
    await plantVerifiedTreeWithSpecies(allSpecies[2].id);
    await plantVerifiedTreeWithSpecies(allSpecies[3].id);

    await achievementService.evaluateUserAchievements(user.id);

    const res = await achievementService.getUserAchievements(user.id);
    expect(res.distinctSpeciesCount).toBe(4);

    const bio = res.achievements.find((a) => a.key === "biodiversity_5");
    expect(bio?.status).toBe("IN_PROGRESS");
    expect(bio?.progress).toBe(4);
  });

  it("at 5 distinct species: biodiversity_5 transitions to UNLOCKED (5/5)", async () => {
    // Add tree for species[4]
    await plantVerifiedTreeWithSpecies(allSpecies[4].id);

    await achievementService.evaluateUserAchievements(user.id);

    const res = await achievementService.getUserAchievements(user.id);
    expect(res.distinctSpeciesCount).toBe(5);

    const bio = res.achievements.find((a) => a.key === "biodiversity_5");
    expect(bio?.status).toBe("UNLOCKED");
    expect(bio?.unlockedAt).not.toBeNull();
    expect(bio?.progress).toBe(5);
  });
});
