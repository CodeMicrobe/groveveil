import type { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../../shared/database/prisma.js";
import { UserRole } from "@prisma/client";

export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
  publicHandle: string;
  status: string;
  role: UserRole;
}

export interface AuthJwtPayload {
  userId: string;
  email?: string;
  role?: UserRole;
  type?: string;
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: AuthJwtPayload;
    user: AuthenticatedUser;
  }
}

/**
 * Authentication Boundary Middleware.
 * Verifies JWT token and resolves active user from database.
 * Rejects untrusted or forged requests with 401.
 */
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      reply.status(401).send({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authorization token is missing or malformed",
        },
        meta: { timestamp: new Date().toISOString(), requestId: request.id },
      });
      return;
    }

    const decoded = await request.jwtVerify<AuthJwtPayload>();
    if (!decoded || !decoded.userId) {
      reply.status(401).send({
        success: false,
        error: {
          code: "INVALID_TOKEN",
          message: "Token payload is invalid",
        },
        meta: { timestamp: new Date().toISOString(), requestId: request.id },
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        publicHandle: true,
        status: true,
        role: true,
      },
    });

    if (!user || user.status !== "ACTIVE") {
      reply.status(401).send({
        success: false,
        error: {
          code: "USER_INACTIVE",
          message: "Account does not exist or has been deactivated",
        },
        meta: { timestamp: new Date().toISOString(), requestId: request.id },
      });
      return;
    }

    request.user = user;
  } catch (err: any) {
    reply.status(401).send({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: err.message || "Invalid or expired token",
      },
      meta: { timestamp: new Date().toISOString(), requestId: request.id },
    });
  }
}
