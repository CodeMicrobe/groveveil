import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/shared/database/prisma.js";
import { loggerOptions } from "../src/shared/observability/logger.js";
import { UserRole } from "@prisma/client";
import type { FastifyInstance } from "fastify";

describe("Tree Location Privacy, Visibility & Projection Leakage Boundaries", () => {
  let app: FastifyInstance;
  let owner: any;
  let nonOwner: any;
  let ownerToken: string;
  let nonOwnerToken: string;
  let operatorToken: string;
  let pendingTreeId: string;
  let verifiedTreeId: string;
  const exactLat = 12.9715987654;
  const exactLng = 77.5945632145;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    owner = await prisma.user.create({
      data: {
        email: `priv_owner_${Date.now()}@example.com`,
        displayName: "Privacy Owner",
        publicHandle: `priv_own_${Date.now()}`,
        status: "ACTIVE",
      },
    });

    nonOwner = await prisma.user.create({
      data: {
        email: `priv_other_${Date.now()}@example.com`,
        displayName: "Privacy Other",
        publicHandle: `priv_oth_${Date.now()}`,
        status: "ACTIVE",
      },
    });

    ownerToken = app.jwt.sign({ userId: owner.id, email: owner.email, role: UserRole.USER });
    nonOwnerToken = app.jwt.sign({ userId: nonOwner.id, email: nonOwner.email, role: UserRole.USER });
    operatorToken = app.jwt.sign({ userId: "operator_audit", role: UserRole.OPERATOR });

    const species = await prisma.treeSpecies.findFirst({ where: { isActive: true } });

    // 1. Pending Tree
    const pendingTree = await prisma.tree.create({
      data: {
        ownerId: owner.id,
        speciesId: species!.id,
        plantedAt: new Date(),
        latitude: exactLat,
        longitude: exactLng,
        locationAccuracy: 6.5,
        locationName: "Private Backyard Garden",
        notes: "Very private notes about secret gate code",
        idempotencyKey: `idemp_priv_pend_${Date.now()}`,
        idempotencyFingerprint: "fp_priv_pend",
        status: "SUBMITTED",
        verificationStatus: "PENDING_VERIFICATION",
      },
    });
    pendingTreeId = pendingTree.id;

    // 2. Verified Tree
    const verifiedTree = await prisma.tree.create({
      data: {
        ownerId: owner.id,
        speciesId: species!.id,
        plantedAt: new Date(),
        latitude: exactLat,
        longitude: exactLng,
        locationAccuracy: 6.5,
        locationName: "Public Community Garden",
        notes: "Private planter notes that must not leak to public",
        idempotencyKey: `idemp_priv_ver_${Date.now()}`,
        idempotencyFingerprint: "fp_priv_ver",
        status: "SUBMITTED",
        verificationStatus: "VERIFIED",
        media: {
          create: {
            storageKey: `trees/${owner.id}/v_${Date.now()}.jpg`,
            mediaType: "image/jpeg",
          },
        },
      },
    });
    verifiedTreeId = verifiedTree.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns exact private GPS coordinates, accuracy, and planter notes to the tree owner", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/trees/${pendingTreeId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.isOwner).toBe(true);
    expect(body.data.latitude).toBe(exactLat);
    expect(body.data.longitude).toBe(exactLng);
    expect(body.data.locationAccuracy).toBe(6.5);
    expect(body.data.notes).toBe("Very private notes about secret gate code");
    // Internal fingerprint must NOT leak
    expect(body.data.idempotencyFingerprint).toBeUndefined();
  });

  it("shields unverified trees (PENDING_VERIFICATION) from non-owner users with 404", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/trees/${pendingTreeId}`,
      headers: { authorization: `Bearer ${nonOwnerToken}` },
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("shields unverified trees (PENDING_VERIFICATION) from anonymous public callers with 404", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/trees/${pendingTreeId}`,
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("allows authorized operators to inspect pending tree reports", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/trees/${pendingTreeId}`,
      headers: { authorization: `Bearer ${operatorToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.latitude).toBe(exactLat);
    expect(body.data.notes).toBe("Very private notes about secret gate code");
  });

  it("strictly enforces public DTO projection on verified trees without data leakage", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/trees/${verifiedTreeId}`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const tree = body.data;

    expect(tree.isOwner).toBe(false);

    // 1. Coordinates MUST be obfuscated (not exact)
    expect(tree.latitude).not.toBe(exactLat);
    expect(tree.longitude).not.toBe(exactLng);
    expect(Math.abs(tree.latitude - exactLat)).toBeLessThan(0.003);

    // 2. Location accuracy MUST be null
    expect(tree.locationAccuracy).toBeNull();

    // 3. Private planter notes MUST NOT be present
    expect(tree.notes).toBeUndefined();

    // 4. Owner identity / email MUST NOT leak
    expect(tree.ownerId).toBeUndefined();
    expect(tree.owner).toBeUndefined();

    // 5. Idempotency keys & fingerprints MUST NOT leak
    expect(tree.idempotencyKey).toBeUndefined();
    expect(tree.idempotencyFingerprint).toBeUndefined();

    // 6. Private storage keys MUST NOT leak in media
    if (tree.media && tree.media.length > 0) {
      expect(tree.media[0].storageKey).toBeUndefined();
    }
  });

  it("strictly redacts latitude, longitude, and locationAccuracy in structured logger configuration", () => {
    const redactConfig = (loggerOptions as any).redact;
    expect(redactConfig).toBeDefined();
    const paths: string[] = redactConfig.paths;

    expect(paths).toContain("req.body.latitude");
    expect(paths).toContain("req.body.longitude");
    expect(paths).toContain("req.body.locationAccuracy");
    expect(paths).toContain("body.latitude");
    expect(paths).toContain("body.longitude");
    expect(paths).toContain("body.locationAccuracy");
    expect(paths).toContain("*.latitude");
    expect(paths).toContain("*.longitude");
    expect(paths).toContain("*.locationAccuracy");
  });
});
