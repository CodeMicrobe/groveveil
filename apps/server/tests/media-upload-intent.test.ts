import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/shared/database/prisma.js";
import type { FastifyInstance } from "fastify";

describe("Media Upload Intent & Binary Storage Lifecycle", () => {
  let app: FastifyInstance;
  let user: any;
  let otherUser: any;
  let userToken: string;
  let otherToken: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    user = await prisma.user.create({
      data: {
        email: `media_user_${Date.now()}@example.com`,
        displayName: "Media Planter",
        publicHandle: `media_planter_${Date.now()}`,
        status: "ACTIVE",
      },
    });

    otherUser = await prisma.user.create({
      data: {
        email: `other_media_${Date.now()}@example.com`,
        displayName: "Other Planter",
        publicHandle: `other_planter_${Date.now()}`,
        status: "ACTIVE",
      },
    });

    userToken = app.jwt.sign({ userId: user.id, email: user.email });
    otherToken = app.jwt.sign({ userId: otherUser.id, email: otherUser.email });
  });

  afterAll(async () => {
    await app.close();
  });

  it("creates a server-authorized upload intent with a bound storageKey", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/media/upload-intent",
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        contentType: "image/jpeg",
        contentLength: 1024 * 500, // 500 KB
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.storageKey).toMatch(new RegExp(`^trees/${user.id}/[a-f0-9-]+.jpg$`));
    expect(body.data.method).toBe("PUT");
    expect(body.data.headers["Content-Type"]).toBe("image/jpeg");

    // Verify DB record
    const intent = await prisma.mediaUploadIntent.findUnique({
      where: { storageKey: body.data.storageKey },
    });
    expect(intent).toBeDefined();
    expect(intent?.userId).toBe(user.id);
    expect(intent?.status).toBe("PENDING_UPLOAD");
  });

  it("rejects unsupported MIME types with 400 Bad Request", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/media/upload-intent",
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        contentType: "application/pdf",
        contentLength: 1024 * 100,
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
  });

  it("rejects oversized content length (>10MB) with 400 Bad Request", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/media/upload-intent",
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        contentType: "image/jpeg",
        contentLength: 15 * 1024 * 1024, // 15MB
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
  });

  it("accepts valid binary upload with genuine JPEG magic bytes", async () => {
    // 1. Create intent
    const intentRes = await app.inject({
      method: "POST",
      url: "/api/v1/media/upload-intent",
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        contentType: "image/jpeg",
        contentLength: 1024,
      },
    });
    const intent = JSON.parse(intentRes.body).data;

    // 2. Construct valid JPEG buffer (starts with FF D8 FF)
    const validJpeg = Buffer.alloc(100);
    validJpeg[0] = 0xff;
    validJpeg[1] = 0xd8;
    validJpeg[2] = 0xff;
    validJpeg[3] = 0xe0;

    const uploadRes = await app.inject({
      method: "PUT",
      url: intent.uploadUrl,
      headers: {
        authorization: `Bearer ${userToken}`,
        "content-type": "image/jpeg",
      },
      payload: validJpeg,
    });

    expect(uploadRes.statusCode).toBe(200);
    const body = JSON.parse(uploadRes.body);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe("UPLOADED");

    // Verify intent in DB transitioned to UPLOADED
    const updated = await prisma.mediaUploadIntent.findUnique({
      where: { storageKey: intent.storageKey },
    });
    expect(updated?.status).toBe("UPLOADED");
    expect(updated?.uploadedAt).toBeDefined();
  });

  it("rejects binary upload with forged/fake image content via magic-byte inspection", async () => {
    const intentRes = await app.inject({
      method: "POST",
      url: "/api/v1/media/upload-intent",
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        contentType: "image/jpeg",
        contentLength: 1024,
      },
    });
    const intent = JSON.parse(intentRes.body).data;

    // Disguised text payload
    const fakeJpeg = Buffer.from("Hello world! I am a fake text file disguised as a JPEG");

    const uploadRes = await app.inject({
      method: "PUT",
      url: intent.uploadUrl,
      headers: {
        authorization: `Bearer ${userToken}`,
        "content-type": "image/jpeg",
      },
      payload: fakeJpeg,
    });

    expect(uploadRes.statusCode).toBe(400);
    const body = JSON.parse(uploadRes.body);
    expect(body.error.code).toBe("INVALID_FILE_SIGNATURE");
  });

  it("rejects upload when upload window has expired (410 Gone)", async () => {
    // Create intent with expired timestamp in DB
    const mediaId = `expired_${Date.now()}`;
    const storageKey = `trees/${user.id}/${mediaId}.jpg`;
    await prisma.mediaUploadIntent.create({
      data: {
        userId: user.id,
        mediaId,
        storageKey,
        mediaType: "image/jpeg",
        maxBytes: 10485760,
        status: "PENDING_UPLOAD",
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
      },
    });

    const validJpeg = Buffer.alloc(50);
    validJpeg[0] = 0xff;
    validJpeg[1] = 0xd8;
    validJpeg[2] = 0xff;

    const uploadRes = await app.inject({
      method: "PUT",
      url: `/api/v1/media/upload/${storageKey}`,
      headers: {
        authorization: `Bearer ${userToken}`,
        "content-type": "image/jpeg",
      },
      payload: validJpeg,
    });

    expect(uploadRes.statusCode).toBe(410);
    const body = JSON.parse(uploadRes.body);
    expect(body.error.code).toBe("EXPIRED_INTENT");
  });

  it("blocks user B from uploading to user A's intent with 403 Forbidden", async () => {
    const intentRes = await app.inject({
      method: "POST",
      url: "/api/v1/media/upload-intent",
      headers: { authorization: `Bearer ${userToken}` },
      payload: {
        contentType: "image/png",
        contentLength: 1024,
      },
    });
    const intent = JSON.parse(intentRes.body).data;

    const validPng = Buffer.alloc(50);
    validPng[0] = 0x89;
    validPng[1] = 0x50;
    validPng[2] = 0x4e;
    validPng[3] = 0x47;
    validPng[4] = 0x0d;
    validPng[5] = 0x0a;
    validPng[6] = 0x1a;
    validPng[7] = 0x0a;

    const uploadRes = await app.inject({
      method: "PUT",
      url: intent.uploadUrl,
      headers: {
        authorization: `Bearer ${otherToken}`, // User B attempting upload
        "content-type": "image/png",
      },
      payload: validPng,
    });

    expect(uploadRes.statusCode).toBe(403);
    const body = JSON.parse(uploadRes.body);
    expect(body.error.code).toBe("FORBIDDEN");
  });
});
