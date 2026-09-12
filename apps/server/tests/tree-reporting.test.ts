import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/shared/database/prisma.js";
import { storageService } from "../src/modules/media/storage.service.js";
import type { FastifyInstance } from "fastify";

describe("Tree Reporting Domain & Submission Endpoint", () => {
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
        email: `report_user_${Date.now()}@example.com`,
        displayName: "Report Planter",
        publicHandle: `rep_planter_${Date.now()}`,
        status: "ACTIVE",
      },
    });

    otherUser = await prisma.user.create({
      data: {
        email: `other_rep_${Date.now()}@example.com`,
        displayName: "Other Reporter",
        publicHandle: `oth_planter_${Date.now()}`,
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

  it("successfully submits a valid tree report and initializes state to SUBMITTED and PENDING_VERIFICATION", async () => {
    const storageKey = await createUploadedPhoto(user.id);
    const idempotencyKey = randomUUID();

    const payload = {
      idempotencyKey,
      speciesId: species.id,
      plantedAt: new Date(Date.now() - 3600000).toISOString(),
      latitude: 12.9715987,
      longitude: 77.5945632,
      locationAccuracy: 8.5,
      locationSource: "DEVICE_GPS",
      locationName: "Cubbon Park, Bengaluru",
      context: "PARK",
      notes: "Planted under the morning canopy",
      photos: [
        {
          storageKey,
          mediaType: "image/jpeg",
          capturedAt: new Date().toISOString(),
        },
      ],
    };

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/trees",
      headers: { authorization: `Bearer ${token}` },
      payload,
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.tree.status).toBe("SUBMITTED");
    expect(body.data.tree.verificationStatus).toBe("PENDING_VERIFICATION");
    expect(body.data.tree.ownerId).toBe(user.id);
    expect(body.data.tree.locationSource).toBe("DEVICE_GPS");
    expect(body.data.tree.locationName).toBe("Cubbon Park, Bengaluru");

    // Verify DB record
    const dbTree = await prisma.tree.findUnique({
      where: { idempotencyKey },
      include: { media: true },
    });
    expect(dbTree).toBeDefined();
    expect(dbTree?.media.length).toBe(1);
    expect(dbTree?.media[0].storageKey).toBe(storageKey);

    // Verify intent transitioned to ATTACHED
    const intent = await prisma.mediaUploadIntent.findUnique({
      where: { storageKey },
    });
    expect(intent?.status).toBe("ATTACHED");
  });

  it("rejects tree report submission missing photographic proof (0 photos) with 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/trees",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        idempotencyKey: randomUUID(),
        speciesId: species.id,
        plantedAt: new Date().toISOString(),
        latitude: 12.9715987,
        longitude: 77.5945632,
        locationSource: "DEVICE_GPS",
        locationName: "Test Location",
        photos: [], // Empty photos
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it("rejects submission attempting to attach another user's photo with 403 Forbidden", async () => {
    // Create photo owned by otherUser
    const otherStorageKey = await createUploadedPhoto(otherUser.id);

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/trees",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        idempotencyKey: randomUUID(),
        speciesId: species.id,
        plantedAt: new Date().toISOString(),
        latitude: 12.9715987,
        longitude: 77.5945632,
        locationSource: "DEVICE_GPS",
        locationName: "Test Location",
        photos: [
          {
            storageKey: otherStorageKey,
            mediaType: "image/jpeg",
          },
        ],
      },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("rejects submission attempting to attach an unuploaded intent with 400 Bad Request", async () => {
    const mediaId = randomUUID();
    const storageKey = `trees/${user.id}/${mediaId}.jpg`;
    await prisma.mediaUploadIntent.create({
      data: {
        userId: user.id,
        mediaId,
        storageKey,
        mediaType: "image/jpeg",
        status: "PENDING_UPLOAD", // Not yet uploaded!
        expiresAt: new Date(Date.now() + 100000),
      },
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/trees",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        idempotencyKey: randomUUID(),
        speciesId: species.id,
        plantedAt: new Date().toISOString(),
        latitude: 12.9715987,
        longitude: 77.5945632,
        locationSource: "DEVICE_GPS",
        locationName: "Test Location",
        photos: [{ storageKey, mediaType: "image/jpeg" }],
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it("rejects future planting dates with 400 Bad Request", async () => {
    const storageKey = await createUploadedPhoto(user.id);
    const futureDate = new Date(Date.now() + 3600000 * 24).toISOString(); // 1 day in future

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/trees",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        idempotencyKey: randomUUID(),
        speciesId: species.id,
        plantedAt: futureDate,
        latitude: 12.9715987,
        longitude: 77.5945632,
        locationSource: "DEVICE_GPS",
        locationName: "Test Location",
        photos: [{ storageKey, mediaType: "image/jpeg" }],
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it("rejects non-DEVICE_GPS location source for authoritative tree proof with 400 Bad Request", async () => {
    const storageKey = await createUploadedPhoto(user.id);

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/trees",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        idempotencyKey: randomUUID(),
        speciesId: species.id,
        plantedAt: new Date().toISOString(),
        latitude: 12.9715987,
        longitude: 77.5945632,
        locationSource: "MANUAL_ENTRY", // Disallowed in Phase 2
        locationName: "Test Location",
        photos: [{ storageKey, mediaType: "image/jpeg" }],
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it("ignores client attempts to forge ownerId or verificationStatus", async () => {
    const storageKey = await createUploadedPhoto(user.id);
    const idempotencyKey = randomUUID();

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/trees",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        idempotencyKey,
        speciesId: species.id,
        plantedAt: new Date().toISOString(),
        latitude: 12.9715987,
        longitude: 77.5945632,
        locationSource: "DEVICE_GPS",
        locationName: "Test Location",
        ownerId: otherUser.id, // Forged owner
        verificationStatus: "VERIFIED", // Forged verification
        photos: [{ storageKey, mediaType: "image/jpeg" }],
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    // Server must have assigned actual authenticated user and PENDING_VERIFICATION
    expect(body.data.tree.ownerId).toBe(user.id);
    expect(body.data.tree.verificationStatus).toBe("PENDING_VERIFICATION");
  });

  it("atomically blocks concurrent submissions from attaching the same UPLOADED photo to different trees", async () => {
    const sharedStorageKey = await createUploadedPhoto(user.id);

    // Two different submissions with different idempotency keys trying to attach the same photo
    const submissionA = app.inject({
      method: "POST",
      url: "/api/v1/trees",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        idempotencyKey: randomUUID(),
        speciesId: species.id,
        plantedAt: new Date().toISOString(),
        latitude: 12.9715987,
        longitude: 77.5945632,
        locationSource: "DEVICE_GPS",
        locationName: "Tree Submission A",
        photos: [{ storageKey: sharedStorageKey, mediaType: "image/jpeg" }],
      },
    });

    const submissionB = app.inject({
      method: "POST",
      url: "/api/v1/trees",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        idempotencyKey: randomUUID(),
        speciesId: species.id,
        plantedAt: new Date().toISOString(),
        latitude: 12.9715987,
        longitude: 77.5945632,
        locationSource: "DEVICE_GPS",
        locationName: "Tree Submission B",
        photos: [{ storageKey: sharedStorageKey, mediaType: "image/jpeg" }],
      },
    });

    const [resA, resB] = await Promise.all([submissionA, submissionB]);

    // Exactly one must succeed (201) and the other must be rejected (409 Conflict)
    const statusCodes = [resA.statusCode, resB.statusCode].sort();
    expect(statusCodes).toEqual([201, 409]);

    // The failing request must indicate Conflict
    const failedRes = resA.statusCode === 409 ? resA : resB;
    const body = JSON.parse(failedRes.body);
    expect(body.error.code).toBe("CONFLICT");
  });
});
