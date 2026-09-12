import crypto from "crypto";
import { prisma } from "../../shared/database/prisma.js";
import { googleAuthVerifier } from "./google-verifier.js";
import type { FastifyInstance } from "fastify";

export class AuthService {
  constructor(private app: FastifyInstance) {}

  private hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  public async loginWithGoogle(
    idToken: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const payload = await googleAuthVerifier.verifyIdToken(idToken);

    // Locate existing user or create a new user profile
    let user = await prisma.user.findUnique({
      where: { email: payload.email.toLowerCase() },
    });

    if (!user) {
      // Generate a unique clean public handle
      const baseHandle = (payload.name || "planter")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 15);
      const uniqueSuffix = Math.floor(1000 + Math.random() * 9000);
      const publicHandle = `${baseHandle || "planter"}_${uniqueSuffix}`;

      user = await prisma.user.create({
        data: {
          email: payload.email.toLowerCase(),
          displayName: payload.name || "Tree Champion",
          publicHandle,
          profileImageUrl: payload.picture || null,
          status: "ACTIVE",
        },
      });

      // Audit Log for user registration
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "USER_REGISTERED",
          details: JSON.stringify({ method: "GOOGLE_OIDC", email: user.email }),
          ipAddress,
        },
      });
    }

    if (user.status !== "ACTIVE") {
      const error = new Error("Account is suspended or deactivated");
      (error as any).statusCode = 403;
      (error as any).code = "ACCOUNT_INACTIVE";
      throw error;
    }

    // Authoritative short-lived Access Token (JWT)
    const token = this.app.jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    // Persistent Opaque Refresh Token with SHA-256 Hashing & Session Storage
    const rawRefreshToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = this.hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash,
        userAgent,
        ipAddress,
        expiresAt,
      },
    });

    // Audit Log for user login
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "USER_LOGIN",
        details: JSON.stringify({ method: "GOOGLE_OIDC" }),
        ipAddress,
      },
    });

    return {
      token,
      refreshToken: rawRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        publicHandle: user.publicHandle,
        profileImageUrl: user.profileImageUrl,
        role: user.role,
        createdAt: user.createdAt,
      },
    };
  }

  /**
   * Refreshes an access token using Refresh Token Rotation (RTR).
   * Validates database-backed session, ensures it has not been revoked or expired,
   * and generates a new refresh token while revoking/replacing the old one.
   */
  public async refreshToken(rawRefreshToken: string) {
    const tokenHash = this.hashToken(rawRefreshToken);

    const session = await prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session) {
      const err = new Error("Invalid refresh token session");
      (err as any).statusCode = 401;
      (err as any).code = "INVALID_SESSION";
      throw err;
    }

    if (session.revokedAt) {
      const err = new Error("Session has been revoked. Please log in again.");
      (err as any).statusCode = 401;
      (err as any).code = "SESSION_REVOKED";
      throw err;
    }

    if (session.expiresAt < new Date()) {
      const err = new Error("Session has expired. Please log in again.");
      (err as any).statusCode = 401;
      (err as any).code = "SESSION_EXPIRED";
      throw err;
    }

    if (session.user.status !== "ACTIVE") {
      const err = new Error("Account not found or inactive");
      (err as any).statusCode = 401;
      (err as any).code = "ACCOUNT_INACTIVE";
      throw err;
    }

    // Refresh Token Rotation: issue a new opaque refresh token and update hash
    const newRawRefreshToken = crypto.randomBytes(32).toString("hex");
    const newTokenHash = this.hashToken(newRawRefreshToken);
    const newExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await prisma.session.update({
      where: { id: session.id },
      data: {
        tokenHash: newTokenHash,
        expiresAt: newExpiresAt,
      },
    });

    // Issue new access token
    const newAccessToken = this.app.jwt.sign(
      { userId: session.user.id, email: session.user.email, role: session.user.role },
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    return {
      token: newAccessToken,
      refreshToken: newRawRefreshToken,
    };
  }

  /**
   * Authoritative Logout & Session Revocation.
   * If rawRefreshToken is provided, revokes that specific session.
   * If not provided, revokes all active sessions for the user.
   */
  public async logout(userId: string, rawRefreshToken?: string) {
    if (rawRefreshToken) {
      const tokenHash = this.hashToken(rawRefreshToken);
      await prisma.session.updateMany({
        where: { tokenHash, userId },
        data: { revokedAt: new Date() },
      });
    } else {
      await prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    await prisma.auditLog.create({
      data: {
        userId,
        action: "USER_LOGOUT",
        details: JSON.stringify({ revokedSession: Boolean(rawRefreshToken) }),
      },
    });
  }
}
