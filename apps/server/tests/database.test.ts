import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma, initializeDatabase } from "../src/shared/database/prisma.js";

describe("Database & Relational Model Integrity", () => {
  beforeAll(async () => {
    await initializeDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("successfully queries seeded species and relational aliases", async () => {
    const species = await prisma.treeSpecies.findFirst({
      where: { commonName: "Mango" },
      include: { aliases: true },
    });

    expect(species).toBeDefined();
    expect(species?.scientificName).toBe("Mangifera indica");
    expect(species?.aliases.length).toBeGreaterThanOrEqual(1);
    expect(species?.aliases.some((a) => a.alias === "Aam")).toBe(true);
  });

  it("enforces foreign key restrictions preventing accidental raw user hard-deletes", async () => {
    // Create a temporary user
    const user = await prisma.user.create({
      data: {
        email: `test_planter_${Date.now()}@example.com`,
        displayName: "Test Planter",
        publicHandle: `test_${Date.now()}`,
        status: "ACTIVE",
      },
    });

    // Create a tree owned by this user
    const species = await prisma.treeSpecies.findFirst();
    expect(species).toBeDefined();

    const tree = await prisma.tree.create({
      data: {
        ownerId: user.id,
        speciesId: species!.id,
        plantedAt: new Date(),
        latitude: 12.9716,
        longitude: 77.5946,
        locationName: "Bengaluru, India",
        idempotencyKey: `idemp_${Date.now()}`,
        idempotencyFingerprint: "test-fingerprint",
        status: "SUBMITTED",
        verificationStatus: "PENDING_VERIFICATION",
      },
    });

    expect(tree).toBeDefined();

    // Attempting a raw SQL hard delete of the user MUST FAIL due to onDelete: Restrict
    await expect(
      prisma.user.delete({
        where: { id: user.id },
      })
    ).rejects.toThrow();

    // Clean up test tree and user safely
    await prisma.tree.delete({ where: { id: tree.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });
});
