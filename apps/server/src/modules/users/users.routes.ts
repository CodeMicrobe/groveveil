import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { authenticate } from "../auth/auth.middleware.js";
import { prisma } from "../../shared/database/prisma.js";
import { successResponse, errorResponse } from "../../shared/types/api.js";

const updateProfileSchema = z.object({
  displayName: z.string().min(2).max(50).optional(),
  profileImageUrl: z.string().url().optional().nullable(),
});

export const userRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Current Authenticated User Profile
  fastify.get("/me", { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.user!.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        _count: {
          select: {
            trees: { where: { verificationStatus: "VERIFIED" } },
            achievements: { where: { status: "UNLOCKED" } },
          },
        },
      },
    });

    if (!user) {
      return reply.status(404).send(
        errorResponse("NOT_FOUND", "User not found", undefined, { requestId: request.id })
      );
    }

    return reply.status(200).send(
      successResponse(
        {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          publicHandle: user.publicHandle,
          profileImageUrl: user.profileImageUrl,
          role: user.role,
          status: user.status,
          createdAt: user.createdAt,
          stats: {
            verifiedTreesCount: user._count.trees,
            unlockedAchievementsCount: user._count.achievements,
          },
        },
        { requestId: request.id }
      )
    );
  });

  // Update Profile
  fastify.patch("/me", { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.user!.id;
    const body = updateProfileSchema.parse(request.body);

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        displayName: body.displayName,
        profileImageUrl: body.profileImageUrl,
      },
    });

    return reply.status(200).send(
      successResponse(
        {
          id: updated.id,
          displayName: updated.displayName,
          publicHandle: updated.publicHandle,
          profileImageUrl: updated.profileImageUrl,
        },
        { requestId: request.id }
      )
    );
  });

  // Controlled Account Deletion / Anonymization Lifecycle
  fastify.delete("/me", { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.user!.id;

    // Transaction executes the approved controlled deletion lifecycle
    await prisma.$transaction(async (tx) => {
      // 1. Invalidate and delete all user sessions
      await tx.session.deleteMany({
        where: { userId },
      });

      // 2. Remove Google Play Games link
      await tx.googlePlayGamesLink.deleteMany({
        where: { userId },
      });

      // 3. Explicitly remove all friendships involving this user
      await tx.friendship.deleteMany({
        where: {
          OR: [{ userAId: userId }, { userBId: userId }, { initiatedById: userId }],
        },
      });

      // 4. Clean up any unattached draft media upload intents
      await tx.mediaUploadIntent.deleteMany({
        where: {
          userId,
          status: { in: ["PENDING_UPLOAD", "EXPIRED"] },
        },
      });

      // 5. Scrub and anonymize User PII
      const anonymizedSuffix = userId.slice(0, 8);
      await tx.user.update({
        where: { id: userId },
        data: {
          status: "DELETED",
          displayName: "Former Planter",
          email: `deleted_${anonymizedSuffix}@anonymized.local`,
          publicHandle: `deleted_${anonymizedSuffix}`,
          profileImageUrl: null,
        },
      });

      // 5. Log the deletion audit event
      await tx.auditLog.create({
        data: {
          userId: null, // Detach direct reference to deleted account
          action: "ACCOUNT_DELETED_ANONYMIZED",
          details: JSON.stringify({ originalUserId: userId }),
          ipAddress: request.ip,
        },
      });
    });

    return reply.status(200).send(
      successResponse(
        { message: "Account has been safely anonymized and removed from active services." },
        { requestId: request.id }
      )
    );
  });

  // Public User Profile (Strictly privacy-safe; hides email, private coordinates, and sensitive info)
  fastify.get("/users/:handle", async (request, reply) => {
    const { handle } = request.params as { handle: string };

    const user = await prisma.user.findUnique({
      where: { publicHandle: handle },
      select: {
        displayName: true,
        publicHandle: true,
        profileImageUrl: true,
        createdAt: true,
        _count: {
          select: {
            trees: { where: { verificationStatus: "VERIFIED" } },
            achievements: { where: { status: "UNLOCKED" } },
          },
        },
      },
    });

    if (!user) {
      return reply.status(404).send(
        errorResponse("NOT_FOUND", "User profile not found", undefined, { requestId: request.id })
      );
    }

    return reply.status(200).send(
      successResponse(
        {
          displayName: user.displayName,
          publicHandle: user.publicHandle,
          profileImageUrl: user.profileImageUrl,
          memberSince: user.createdAt,
          stats: {
            verifiedTreesCount: user._count.trees,
            unlockedAchievementsCount: user._count.achievements,
          },
        },
        { requestId: request.id }
      )
    );
  });
};
