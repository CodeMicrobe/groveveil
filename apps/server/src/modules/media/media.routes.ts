import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { prisma } from "../../shared/database/prisma.js";
import { UserRole } from "@prisma/client";
import { authenticate, type AuthJwtPayload } from "../auth/auth.middleware.js";
import { validateRequest } from "../../shared/middleware/validate.js";
import { successResponse, errorResponse } from "../../shared/types/api.js";
import {
  createUploadIntentSchema,
  MAX_MEDIA_SIZE_BYTES,
  type AllowedMediaType,
} from "./media.schemas.js";
import { storageService, sniffImageMagicBytes } from "./storage.service.js";

const EXTENSION_MAP: Record<AllowedMediaType, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export const mediaRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Support raw binary streams for PUT uploads up to 10MB
  fastify.addContentTypeParser(
    ["image/jpeg", "image/png", "image/webp", "application/octet-stream"],
    { parseAs: "buffer", bodyLimit: MAX_MEDIA_SIZE_BYTES },
    (_req, body, done) => {
      done(null, body);
    }
  );

  // 1. Request Authorized Upload Intent
  fastify.post(
    "/media/upload-intent",
    {
      preHandler: [authenticate, validateRequest({ body: createUploadIntentSchema })],
    },
    async (request, reply) => {
      const { contentType, contentLength } = request.body as {
        contentType: AllowedMediaType;
        contentLength: number;
      };

      const mediaId = randomUUID();
      const ext = EXTENSION_MAP[contentType];
      const storageKey = `trees/${request.user.id}/${mediaId}${ext}`;
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15-minute upload window

      const intent = await prisma.mediaUploadIntent.create({
        data: {
          userId: request.user.id,
          mediaId,
          storageKey,
          mediaType: contentType,
          maxBytes: MAX_MEDIA_SIZE_BYTES,
          status: "PENDING_UPLOAD",
          expiresAt,
        },
      });

      return reply.status(201).send(
        successResponse(
          {
            intentId: intent.id,
            mediaId,
            storageKey,
            uploadUrl: `/api/v1/media/upload/${storageKey}`,
            method: "PUT",
            headers: {
              "Content-Type": contentType,
            },
            maxBytes: MAX_MEDIA_SIZE_BYTES,
            expiresAt: expiresAt.toISOString(),
          },
          { requestId: request.id }
        )
      );
    }
  );

  // 2. Direct Binary Upload (Local Dev Adapter matching S3 pre-signed PUT semantics)
  fastify.put(
    "/media/upload/*",
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const wildcard = (request.params as { "*": string })["*"];
      const storageKey = wildcard?.trim();

      if (!storageKey || storageKey.includes("..")) {
        return reply
          .status(400)
          .send(errorResponse("INVALID_PATH", "Invalid storage key path", undefined, { requestId: request.id }));
      }

      const intent = await prisma.mediaUploadIntent.findUnique({
        where: { storageKey },
      });

      if (!intent) {
        return reply
          .status(404)
          .send(errorResponse("NOT_FOUND", "Upload intent not found", undefined, { requestId: request.id }));
      }

      // Check ownership
      if (intent.userId !== request.user.id) {
        return reply
          .status(403)
          .send(errorResponse("FORBIDDEN", "You do not have permission to upload to this destination", undefined, { requestId: request.id }));
      }

      // Check expiration of PENDING_UPLOAD
      if (intent.status === "PENDING_UPLOAD" && Date.now() > intent.expiresAt.getTime()) {
        await prisma.mediaUploadIntent.update({
          where: { id: intent.id },
          data: { status: "EXPIRED" },
        });
        return reply
          .status(410)
          .send(errorResponse("EXPIRED_INTENT", "Upload window has expired. Please request a new upload intent.", undefined, { requestId: request.id }));
      }

      if (intent.status !== "PENDING_UPLOAD") {
        return reply
          .status(400)
          .send(errorResponse("INVALID_STATUS", `Upload intent is in ${intent.status} state and cannot accept uploads`, undefined, { requestId: request.id }));
      }

      const rawBuffer = request.body as Buffer;
      if (!rawBuffer || rawBuffer.length === 0) {
        return reply
          .status(400)
          .send(errorResponse("EMPTY_BODY", "Upload binary payload is empty", undefined, { requestId: request.id }));
      }

      if (rawBuffer.length > intent.maxBytes) {
        return reply
          .status(413)
          .send(errorResponse("PAYLOAD_TOO_LARGE", `File exceeds max permitted size of ${intent.maxBytes} bytes`, undefined, { requestId: request.id }));
      }

      // Magic byte sniffing to verify file binary signature
      const detectedType = sniffImageMagicBytes(rawBuffer);
      if (!detectedType || detectedType !== intent.mediaType) {
        return reply
          .status(400)
          .send(errorResponse("INVALID_FILE_SIGNATURE", "File binary does not match declared image signature", undefined, { requestId: request.id }));
      }

      // Save to disk
      await storageService.saveBinary(storageKey, rawBuffer);

      // Transition state: PENDING_UPLOAD -> UPLOADED
      await prisma.mediaUploadIntent.update({
        where: { id: intent.id },
        data: {
          status: "UPLOADED",
          uploadedAt: new Date(),
        },
      });

      return reply.status(200).send(
        successResponse(
          {
            storageKey,
            status: "UPLOADED",
            bytesWritten: rawBuffer.length,
          },
          { requestId: request.id }
        )
      );
    }
  );

  // 3. Authorized Media Delivery
  fastify.get("/media/*", async (request, reply) => {
    const wildcard = (request.params as { "*": string })["*"];
    let storageKey: string;
    try {
      storageKey = decodeURIComponent(wildcard || "").trim();
    } catch {
      return reply
        .status(400)
        .send(errorResponse("INVALID_PATH", "Invalid URL encoding in storage key", undefined, { requestId: request.id }));
    }

    if (!storageKey || storageKey.includes("..") || storageKey.startsWith("/")) {
      return reply
        .status(400)
        .send(errorResponse("INVALID_PATH", "Invalid storage key path", undefined, { requestId: request.id }));
    }

    // Try resolving optional authenticated user from Bearer header
    let callerUserId: string | null = null;
    let isOperator = false;
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const decoded = await request.jwtVerify<AuthJwtPayload>();
        if (decoded?.userId) {
          callerUserId = decoded.userId;
          if (decoded.role === UserRole.OPERATOR) {
            isOperator = true;
          }
        }
      } catch {
        // Optional auth: treat as unauthenticated public
      }
    }

    if (
      process.env.OPERATOR_API_KEY &&
      request.headers["x-operator-key"] === process.env.OPERATOR_API_KEY
    ) {
      isOperator = true;
    }

    // Check if media is attached to a Tree
    const treeMedia = await prisma.treeMedia.findUnique({
      where: { storageKey },
      include: {
        tree: {
          select: {
            id: true,
            ownerId: true,
            status: true,
            verificationStatus: true,
          },
        },
      },
    });

    if (treeMedia) {
      const tree = treeMedia.tree;

      // Rule: Planter (owner) can always retrieve their own submitted evidence
      const isOwner = callerUserId && callerUserId === tree.ownerId;
      if (isOwner) {
        return streamMedia(storageKey, treeMedia.mediaType, reply);
      }

      // Rule: Authorized reviewers/operators can access evidence
      if (isOperator) {
        return streamMedia(storageKey, treeMedia.mediaType, reply);
      }

      // Rule: Public users may ONLY retrieve media when tree is VERIFIED
      if (tree.status === "SUBMITTED" && tree.verificationStatus === "VERIFIED") {
        return streamMedia(storageKey, treeMedia.mediaType, reply);
      }

      // Otherwise, submitted-but-unverified evidence is strictly shielded
      return reply.status(403).send(
        errorResponse(
          "FORBIDDEN",
          "Tree photographic evidence is private until verified",
          undefined,
          { requestId: request.id }
        )
      );
    }

    // Check if it's an unattached upload intent
    const intent = await prisma.mediaUploadIntent.findUnique({
      where: { storageKey },
    });

    if (intent) {
      // Only the owning planter can retrieve their own unattached draft/upload
      if (callerUserId && callerUserId === intent.userId) {
        return streamMedia(storageKey, intent.mediaType, reply);
      }

      return reply.status(403).send(
        errorResponse(
          "FORBIDDEN",
          "Unattached or draft media is private",
          undefined,
          { requestId: request.id }
        )
      );
    }

    return reply
      .status(404)
      .send(errorResponse("NOT_FOUND", "Media not found", undefined, { requestId: request.id }));
  });
};

async function streamMedia(storageKey: string, mediaType: string, reply: any) {
  const exists = await storageService.exists(storageKey);
  if (!exists) {
    return reply.status(404).send({
      success: false,
      error: { code: "NOT_FOUND", message: "Media file not found on storage" },
    });
  }

  const stream = storageService.createReadStream(storageKey);
  return reply
    .header("Content-Type", mediaType)
    .header("Cache-Control", "private, max-age=3600")
    .send(stream);
}
