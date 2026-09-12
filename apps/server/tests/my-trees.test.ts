import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/shared/database/prisma.js";
import { storageService } from "../src/modules/media/storage.service.js";
import type { FastifyInstance } from "fastify";

describe("My Trees Journal Foundation Endpoint", () => {
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
        email: `journal_user_${Date.now()}@example.com`,
        displayName: "Journal Planter",
        publicHandle: `journal_${Date.now()}`,
        status: "ACTIVE",
      },
    });

    otherUser = await prisma.user.create({
      data: {
        email: `journal_other_${Date.now()}@example.com`,
        displayName: "Other Journal Planter",
        publicHandle: `oth_journal_${Date.now()}`,
        status: "ACTIVE",
      },
    });

    token = app.jwt.sign({ userId: user.id, email: user.email });
    otherToken = app.jwt.sign({ userId: otherUser.id, email: otherUser.email });

    species = await prisma.treeSpecies.findFirst({ where: { isActive: true } });

    // Seed 2 trees for user
    const storageKey1 = `trees/${user.id}/j1_${Date.now()}.jpg`;
    const storageKey2 = `trees/${user.id}/j2_${Date.now()}.jpg`;
    const jpegBuffer = Buffer.alloc(50);
    jpegBuffer[0] = 0xff;
    jpegBuffer[1] = 0xd8;
    jpegBuffer[2] = 0xff;
    await storageService.saveBinary(storageKey1, jpegBuffer);
    await storageService.saveBinary(storageKey2, jpegBuffer);

    await prisma.tree.create({
      data: {
        ownerId: user.id,
        speciesId: species.id,
        plantedAt: new Date(Date.now() - 100000),
        latitude: 12.9715987,
        longitude: 77.5945632,
        locationAccuracy: 5.2,
        locationName: "Journal Tree 1",
        idempotencyKey: `idemp_j1_${Date.now()}`,
        idempotencyFingerprint: "fp1",
        status: "SUBMITTED",
        verificationStatus: "PENDING_VERIFICATION",
        media: {
          create: { storageKey: storageKey1, mediaType: "image/jpeg" },
        },
      },
    });

    await prisma.tree.create({
      data: {
        ownerId: user.id,
        speciesId: species.id,
        plantedAt: new Date(Date.now() - 50000),
        latitude: 12.9725987,
        longitude: 77.5955632,
        locationAccuracy: 4.8,
        locationName: "Journal Tree 2",
        idempotencyKey: `idemp_j2_${Date.now()}`,
        idempotencyFingerprint: "fp2",
        status: "SUBMITTED",
        verificationStatus: "PENDING_VERIFICATION",
        media: {
          create: { storageKey: storageKey2, mediaType: "image/jpeg" },
        },
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("retrieves the user's personal tree journal with verification status and exact coordinates", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/trees/me",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.length).toBe(2);

    // Verify ordering by plantedAt desc
    expect(body.data[0].locationName).toBe("Journal Tree 2");
    expect(body.data[1].locationName).toBe("Journal Tree 1");

    // Owner receives exact coordinates and accuracy
    expect(body.data[0].latitude).toBe(12.9725987);
    expect(body.data[0].locationAccuracy).toBe(4.8);
    expect(body.data[0].verificationStatus).toBe("PENDING_VERIFICATION");
    expect(body.data[0].media.length).toBe(1);
    expect(body.data[0].species.commonName).toBeDefined();
  });

  it("returns an empty journal for another user with no trees", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/trees/me",
      headers: { authorization: `Bearer ${otherToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.length).toBe(0);
  });
});
