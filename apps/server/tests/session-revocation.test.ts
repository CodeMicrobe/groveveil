import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/shared/database/prisma.js";
import { AuthService } from "../src/modules/auth/auth.service.js";
import type { FastifyInstance } from "fastify";
import crypto from "crypto";

describe("Session Persistence, Token Rotation & Revocation", () => {
  let app: FastifyInstance;
  let authService: AuthService;
  let testUser: { id: string; email: string };

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    authService = new AuthService(app);

    // Create a real active test user in database
    testUser = await prisma.user.create({
      data: {
        email: `session_test_${Date.now()}@example.com`,
        displayName: "Session Tester",
        publicHandle: `sesstest_${Date.now()}`,
        status: "ACTIVE",
      },
    });
  });

  afterAll(async () => {
    await prisma.session.deleteMany({ where: { userId: testUser.id } });
    await prisma.auditLog.deleteMany({ where: { userId: testUser.id } });
    await prisma.user.delete({ where: { id: testUser.id } });
    await app.close();
  });

  it("persists an opaque refresh token as a SHA-256 hash in the database", async () => {
    const rawRefreshToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawRefreshToken).digest("hex");

    const session = await prisma.session.create({
      data: {
        userId: testUser.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60), // 1 hour
      },
    });

    expect(session).toBeDefined();
    expect(session.revokedAt).toBeNull();
    expect(session.tokenHash).toBe(tokenHash);

    // Verify token can be refreshed
    const refreshResult = await authService.refreshToken(rawRefreshToken);
    expect(refreshResult.token).toBeDefined();
    expect(refreshResult.refreshToken).toBeDefined();
    expect(refreshResult.refreshToken).not.toBe(rawRefreshToken); // Token rotated!

    // The old refresh token must be invalid now
    await expect(authService.refreshToken(rawRefreshToken)).rejects.toThrow(
      "Invalid refresh token session"
    );

    // Clean up
    await prisma.session.delete({ where: { id: session.id } });
  });

  it("rejects refresh requests when session has been revoked upon logout", async () => {
    const rawRefreshToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawRefreshToken).digest("hex");

    const session = await prisma.session.create({
      data: {
        userId: testUser.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      },
    });

    // Authoritative Logout / Revocation
    await authService.logout(testUser.id, rawRefreshToken);

    const updatedSession = await prisma.session.findUnique({
      where: { id: session.id },
    });
    expect(updatedSession?.revokedAt).not.toBeNull();

    // Attempting to refresh using revoked session must be rejected with 401
    await expect(authService.refreshToken(rawRefreshToken)).rejects.toThrow(
      "Session has been revoked"
    );

    // Clean up
    await prisma.session.delete({ where: { id: session.id } });
  });

  it("rejects refresh requests when session has expired", async () => {
    const rawRefreshToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawRefreshToken).digest("hex");

    const session = await prisma.session.create({
      data: {
        userId: testUser.id,
        tokenHash,
        expiresAt: new Date(Date.now() - 1000 * 60), // Expired 1 min ago
      },
    });

    await expect(authService.refreshToken(rawRefreshToken)).rejects.toThrow(
      "Session has expired"
    );

    // Clean up
    await prisma.session.delete({ where: { id: session.id } });
  });
});
