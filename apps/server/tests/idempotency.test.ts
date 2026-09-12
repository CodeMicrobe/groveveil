import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/shared/database/prisma.js";
import { storageService } from "../src/modules/media/storage.service.js";
import type { FastifyInstance } from "fastify";

describe("True Request-Idempotency & Concurrency Safety", () => {
  let app: FastifyInstance;
  let user: any;
  let otherUser: any;
  let token: string;
  let otherToken: string;
  let species: any;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    user = await prisma.user.create({
      data: {
        email: `idemp_user_${Date.now()}@example.com`,
        displayName: "Idempotency Planter",
        publicHandle: `idemp_${Date.now()}`,
        status: "ACTIVE",
      },
    });

    otherUser = await prisma.user.create({
      data: {
        email: `idemp_other_${Date.now()}@example.com`,
        displayName: "Other Idemp Planter",
        publicHandle: `oth_idemp_${Date.now()}`,
        status: "ACTIVE",
      },
    });

    token = app.jwt.sign({ userId: user.id, email: user.email });
    otherToken = app.jwt.sign({ userId: otherUser.id, email: otherUser.email });

    species = await prisma.treeSpecies.findFirst({ where: { isActive: true } });
  });

  afterAll(async () => {
    await app.close();
  });

  async function createUploadedPhoto(userId: string) {
    const mediaId = randomUUID();
    const storageKey = `trees/${userId}/${mediaId}.jpg`;
    const jpegBuffer = Buffer.alloc(50);
    jpegBuffer[0] = 0xff;
    jpegBuffer[1] = 0xd8;
    jpegBuffer[2] = 0xff;
    await storageService.saveBinary(storageKey, jpegBuffer);

    await prisma.mediaUploadIntent.create({
      data: {
        userId,
        mediaId,
        storageKey,
        mediaType: "image/jpeg",
        status: "UPLOADED",
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    return storageKey;
  }

  it("returns 200 OK idempotent replay when same user submits exact same payload with same idempotencyKey", async () => {
    const storageKey = await createUploadedPhoto(user.id);
    const idempotencyKey = randomUUID();
    const plantedAt = new Date().toISOString();

    const payload = {
      idempotencyKey,
      speciesId: species.id,
      plantedAt,
      latitude: 12.9715987,
      longitude: 77.5945632,
      locationAccuracy: 10.0,
      locationSource: "DEVICE_GPS",
      locationName: "Idempotency Park",
      notes: "First attempt",
      photos: [{ storageKey, mediaType: "image/jpeg" }],
    };

    // 1. First submission -> 201 Created
    const res1 = await app.inject({
      method: "POST",
      url: "/api/v1/trees",
      headers: { authorization: `Bearer ${token}` },
      payload,
    });
    expect(res1.statusCode).toBe(201);
    const body1 = JSON.parse(res1.body);
    expect(body1.data.isReplay).toBe(false);
    const createdTreeId = body1.data.tree.id;

    // 2. Repeated submission -> 200 OK replay
    const res2 = await app.inject({
      method: "POST",
      url: "/api/v1/trees",
      headers: { authorization: `Bearer ${token}` },
      payload,
    });
    expect(res2.statusCode).toBe(200);
    const body2 = JSON.parse(res2.body);
    expect(body2.data.isReplay).toBe(true);
    expect(body2.data.tree.id).toBe(createdTreeId);

    // 3. Verify exactly one tree exists in DB
    const count = await prisma.tree.count({
      where: { idempotencyKey },
    });
    expect(count).toBe(1);
  });

  it("rejects with 409 Conflict when same user resubmits same idempotencyKey with modified payload", async () => {
    const storageKey = await createUploadedPhoto(user.id);
    const idempotencyKey = randomUUID();
    const plantedAt = new Date().toISOString();

    const initialPayload = {
      idempotencyKey,
      speciesId: species.id,
      plantedAt,
      latitude: 12.9715987,
      longitude: 77.5945632,
      locationSource: "DEVICE_GPS",
      locationName: "Original Location",
      photos: [{ storageKey, mediaType: "image/jpeg" }],
    };

    // Initial submission
    const res1 = await app.inject({
      method: "POST",
      url: "/api/v1/trees",
      headers: { authorization: `Bearer ${token}` },
      payload: initialPayload,
    });
    expect(res1.statusCode).toBe(201);

    // Modified submission (different locationName)
    const modifiedPayload = {
      ...initialPayload,
      locationName: "Tampered Location Name",
    };

    const res2 = await app.inject({
      method: "POST",
      url: "/api/v1/trees",
      headers: { authorization: `Bearer ${token}` },
      payload: modifiedPayload,
    });
    expect(res2.statusCode).toBe(409);
    const body2 = JSON.parse(res2.body);
    expect(body2.error.code).toBe("CONFLICT");
  });

  it("rejects with 409 Conflict when a different user reuses an existing idempotencyKey", async () => {
    const storageKey = await createUploadedPhoto(user.id);
    const idempotencyKey = randomUUID();

    const payload = {
      idempotencyKey,
      speciesId: species.id,
      plantedAt: new Date().toISOString(),
      latitude: 12.9715987,
      longitude: 77.5945632,
      locationSource: "DEVICE_GPS",
      locationName: "User A Location",
      photos: [{ storageKey, mediaType: "image/jpeg" }],
    };

    // User A submits
    const res1 = await app.inject({
      method: "POST",
      url: "/api/v1/trees",
      headers: { authorization: `Bearer ${token}` },
      payload,
    });
    expect(res1.statusCode).toBe(201);

    // User B submits with same idempotencyKey
    const otherStorageKey = await createUploadedPhoto(otherUser.id);
    const userBPayload = {
      ...payload,
      photos: [{ storageKey: otherStorageKey, mediaType: "image/jpeg" }],
    };

    const res2 = await app.inject({
      method: "POST",
      url: "/api/v1/trees",
      headers: { authorization: `Bearer ${otherToken}` },
      payload: userBPayload,
    });
    expect(res2.statusCode).toBe(409);
    const body2 = JSON.parse(res2.body);
    expect(body2.error.code).toBe("CONFLICT");
  });

  it("safely resolves concurrent simultaneous requests with the same key to exactly 1 tree", async () => {
    const storageKey = await createUploadedPhoto(user.id);
    const idempotencyKey = randomUUID();
    const plantedAt = new Date().toISOString();

    const payload = {
      idempotencyKey,
      speciesId: species.id,
      plantedAt,
      latitude: 12.9715987,
      longitude: 77.5945632,
      locationSource: "DEVICE_GPS",
      locationName: "Concurrency Forest",
      photos: [{ storageKey, mediaType: "image/jpeg" }],
    };

    // Fire 5 concurrent requests simultaneously
    const promises = Array.from({ length: 5 }).map(() =>
      app.inject({
        method: "POST",
        url: "/api/v1/trees",
        headers: { authorization: `Bearer ${token}` },
        payload,
      })
    );

    const responses = await Promise.all(promises);

    // All should be successful (either 201 or 200)
    for (const res of responses) {
      expect([200, 201]).toContain(res.statusCode);
    }

    const createdCount = responses.filter((r) => r.statusCode === 201).length;
    const replayCount = responses.filter((r) => r.statusCode === 200).length;

    expect(createdCount).toBe(1);
    expect(replayCount).toBe(4);

    // Verify DB has strictly 1 tree
    const dbTrees = await prisma.tree.findMany({
      where: { idempotencyKey },
    });
    expect(dbTrees.length).toBe(1);
  });
});
