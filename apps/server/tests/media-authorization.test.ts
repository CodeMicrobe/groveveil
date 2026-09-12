import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/shared/database/prisma.js";
import { storageService } from "../src/modules/media/storage.service.js";
import { UserRole } from "@prisma/client";
import type { FastifyInstance } from "fastify";

describe("Media Delivery Authorization Matrix", () => {
  let app: FastifyInstance;
  let planter: any;
  let otherUser: any;
  let planterToken: string;
  let otherToken: string;
  let operatorToken: string;
  let pendingStorageKey: string;
  let verifiedStorageKey: string;
  let unattachedStorageKey: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    planter = await prisma.user.create({
      data: {
        email: `planter_auth_${Date.now()}@example.com`,
        displayName: "Auth Planter",
        publicHandle: `auth_planter_${Date.now()}`,
        status: "ACTIVE",
      },
    });

    otherUser = await prisma.user.create({
      data: {
        email: `other_auth_${Date.now()}@example.com`,
        displayName: "Other Auth",
        publicHandle: `other_auth_${Date.now()}`,
        status: "ACTIVE",
      },
    });

    planterToken = app.jwt.sign({ userId: planter.id, email: planter.email, role: UserRole.USER });
    otherToken = app.jwt.sign({ userId: otherUser.id, email: otherUser.email, role: UserRole.USER });
    operatorToken = app.jwt.sign({ userId: "operator_audit_1", role: UserRole.OPERATOR });

    const species = await prisma.treeSpecies.findFirst();

    // 1. Create a tree with PENDING_VERIFICATION and attached media
    pendingStorageKey = `trees/${planter.id}/pending_${Date.now()}.jpg`;
    const jpegBuffer = Buffer.alloc(50);
    jpegBuffer[0] = 0xff;
    jpegBuffer[1] = 0xd8;
    jpegBuffer[2] = 0xff;
    await storageService.saveBinary(pendingStorageKey, jpegBuffer);

    await prisma.tree.create({
      data: {
        ownerId: planter.id,
        speciesId: species!.id,
        plantedAt: new Date(),
        latitude: 12.9716,
        longitude: 77.5946,
        locationName: "Bengaluru",
        idempotencyKey: `idemp_pend_${Date.now()}`,
        idempotencyFingerprint: "fp_pend",
        status: "SUBMITTED",
        verificationStatus: "PENDING_VERIFICATION",
        media: {
          create: {
            storageKey: pendingStorageKey,
            mediaType: "image/jpeg",
          },
        },
      },
    });

    // 2. Create a tree with VERIFIED status and attached media
    verifiedStorageKey = `trees/${planter.id}/verified_${Date.now()}.jpg`;
    await storageService.saveBinary(verifiedStorageKey, jpegBuffer);

    await prisma.tree.create({
      data: {
        ownerId: planter.id,
        speciesId: species!.id,
        plantedAt: new Date(),
        latitude: 12.9716,
        longitude: 77.5946,
        locationName: "Bengaluru",
        idempotencyKey: `idemp_ver_${Date.now()}`,
        idempotencyFingerprint: "fp_ver",
        status: "SUBMITTED",
        verificationStatus: "VERIFIED",
        media: {
          create: {
            storageKey: verifiedStorageKey,
            mediaType: "image/jpeg",
          },
        },
      },
    });

    // 3. Create unattached upload intent (not yet linked to any tree)
    unattachedStorageKey = `trees/${planter.id}/unattached_${Date.now()}.jpg`;
    await storageService.saveBinary(unattachedStorageKey, jpegBuffer);

    await prisma.mediaUploadIntent.create({
      data: {
        userId: planter.id,
        mediaId: `unat_${Date.now()}`,
        storageKey: unattachedStorageKey,
        mediaType: "image/jpeg",
        status: "UPLOADED",
        expiresAt: new Date(Date.now() + 100000),
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("allows the planter (owner) to view their own pending verification media", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/media/${pendingStorageKey}`,
      headers: { authorization: `Bearer ${planterToken}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("image/jpeg");
  });

  it("allows an authorized operator with signed JWT role to view pending submitted media", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/media/${pendingStorageKey}`,
      headers: { authorization: `Bearer ${operatorToken}` },
    });

    expect(res.statusCode).toBe(200);
  });

  it("rejects unauthenticated requests attempting to spoof x-role: operator header with 403 Forbidden", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/media/${pendingStorageKey}`,
      headers: { "x-role": "operator" }, // Spoofed header without valid signed token
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("shields pending verification media from public/unauthenticated callers with 403 Forbidden", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/media/${pendingStorageKey}`,
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("shields pending verification media from other non-owner planters with 403 Forbidden", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/media/${pendingStorageKey}`,
      headers: { authorization: `Bearer ${otherToken}` },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("allows public access to media once the tree is VERIFIED", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/media/${verifiedStorageKey}`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("image/jpeg");
  });

  it("shields unattached draft media from public callers with 403 Forbidden even if storageKey is guessed", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/media/${unattachedStorageKey}`,
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("allows the planter to view their own unattached draft media", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/media/${unattachedStorageKey}`,
      headers: { authorization: `Bearer ${planterToken}` },
    });

    expect(res.statusCode).toBe(200);
  });

  it("blocks path traversal attempts with 400 Bad Request", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/media/trees%2F..%2Fsecret.txt",
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe("INVALID_PATH");
  });
});
