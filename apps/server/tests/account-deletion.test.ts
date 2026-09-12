import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/shared/database/prisma.js";
import type { FastifyInstance } from "fastify";

describe("Account Deletion Lifecycle & Auditability Preservation", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("safely anonymizes user, revokes sessions, deletes friendships, and preserves tree audit records", async () => {
    // 1. Create a user
    const user = await prisma.user.create({
      data: {
        email: `delete_me_${Date.now()}@example.com`,
        displayName: "John Doe",
        publicHandle: `johndoe_${Date.now()}`,
        status: "ACTIVE",
      },
    });

    // 2. Create another user for friendship
    const friend = await prisma.user.create({
      data: {
        email: `friend_${Date.now()}@example.com`,
        displayName: "Jane Friend",
        publicHandle: `janefriend_${Date.now()}`,
        status: "ACTIVE",
      },
    });

    // 3. Create a canonical friendship
    const userAId = user.id < friend.id ? user.id : friend.id;
    const userBId = user.id < friend.id ? friend.id : user.id;
    const friendship = await prisma.friendship.create({
      data: {
        userAId,
        userBId,
        initiatedById: user.id,
        status: "ACCEPTED",
      },
    });

    // 4. Create an active session
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: `hash_${Date.now()}`,
        expiresAt: new Date(Date.now() + 100000),
      },
    });

    // 5. Create a tree record
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
        idempotencyKey: `idemp_del_${Date.now()}`,
        idempotencyFingerprint: "test-fingerprint-del",
        status: "SUBMITTED",
        verificationStatus: "VERIFIED",
      },
    });

    // 6. Generate valid JWT for the user to invoke DELETE /api/v1/me
    const token = app.jwt.sign({ userId: user.id, email: user.email });

    const response = await app.inject({
      method: "DELETE",
      url: "/api/v1/me",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);

    // 7. Verify post-deletion state in database
    const anonymizedUser = await prisma.user.findUnique({
      where: { id: user.id },
    });
    expect(anonymizedUser).toBeDefined();
    expect(anonymizedUser?.status).toBe("DELETED");
    expect(anonymizedUser?.displayName).toBe("Former Planter");
    expect(anonymizedUser?.email).toContain("@anonymized.local");
    expect(anonymizedUser?.publicHandle).toContain("deleted_");

    // Sessions should be deleted/revoked
    const remainingSessions = await prisma.session.findMany({
      where: { userId: user.id },
    });
    expect(remainingSessions.length).toBe(0);

    // Friendship should be cleaned up
    const remainingFriendship = await prisma.friendship.findUnique({
      where: { id: friendship.id },
    });
    expect(remainingFriendship).toBeNull();

    // The Tree record MUST be preserved for auditability!
    const retainedTree = await prisma.tree.findUnique({
      where: { id: tree.id },
    });
    expect(retainedTree).toBeDefined();
    expect(retainedTree?.ownerId).toBe(user.id);
    expect(retainedTree?.verificationStatus).toBe("VERIFIED");

    // Clean up test records
    await prisma.tree.delete({ where: { id: tree.id } });
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.user.delete({ where: { id: friend.id } });
  });

  it("physically blocks direct destructive database deletions of users with active friendships", async () => {
    const user1 = await prisma.user.create({
      data: {
        email: `u1_${Date.now()}@example.com`,
        displayName: "User One",
        publicHandle: `u1_${Date.now()}`,
      },
    });
    const user2 = await prisma.user.create({
      data: {
        email: `u2_${Date.now()}@example.com`,
        displayName: "User Two",
        publicHandle: `u2_${Date.now()}`,
      },
    });

    const userAId = user1.id < user2.id ? user1.id : user2.id;
    const userBId = user1.id < user2.id ? user2.id : user1.id;
    const friendship = await prisma.friendship.create({
      data: {
        userAId,
        userBId,
        initiatedById: user1.id,
      },
    });

    // Attempting direct raw delete of user1 MUST FAIL due to onDelete: Restrict
    await expect(prisma.user.delete({ where: { id: user1.id } })).rejects.toThrow();

    // Clean up
    await prisma.friendship.delete({ where: { id: friendship.id } });
    await prisma.user.delete({ where: { id: user1.id } });
    await prisma.user.delete({ where: { id: user2.id } });
  });
});
