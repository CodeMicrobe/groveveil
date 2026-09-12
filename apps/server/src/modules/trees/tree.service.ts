import crypto from "node:crypto";
import { VerificationStatus } from "@prisma/client";
import { prisma } from "../../shared/database/prisma.js";
import { storageService } from "../media/storage.service.js";
import { obfuscateCoordinates } from "../../shared/utils/location.js";
import { achievementService } from "../achievements/achievement.service.js";
import type { SubmitTreeDTO } from "./tree.schemas.js";

export class ConflictError extends Error {
  public code = "CONFLICT";
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export class ValidationError extends Error {
  public code = "VALIDATION_ERROR";
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends Error {
  public code = "NOT_FOUND";
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ForbiddenError extends Error {
  public code = "FORBIDDEN";
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Deterministic canonical idempotency fingerprint computation.
 * Strict key ordering and normalization over every meaningful server-accepted field.
 */
export function computeSubmissionFingerprint(dto: SubmitTreeDTO): string {
  // Sort photos deterministically by storageKey
  const sortedPhotos = [...dto.photos]
    .sort((a, b) => a.storageKey.localeCompare(b.storageKey))
    .map((p) => ({
      capturedAt: p.capturedAt ? new Date(p.capturedAt).toISOString() : null,
      mediaType: p.mediaType,
      storageKey: p.storageKey.trim(),
    }));

  const canonical = {
    context: dto.context || null,
    latitude: Number(dto.latitude.toFixed(7)),
    locationAccuracy:
      dto.locationAccuracy != null ? Number(dto.locationAccuracy.toFixed(2)) : null,
    locationName: dto.locationName.trim(),
    locationSource: "DEVICE_GPS",
    longitude: Number(dto.longitude.toFixed(7)),
    notes: dto.notes ? dto.notes.trim() : null,
    photos: sortedPhotos,
    plantedAt: new Date(dto.plantedAt).toISOString(),
    speciesId: dto.speciesId.toLowerCase().trim(),
  };

  return crypto
    .createHash("sha256")
    .update(JSON.stringify(canonical))
    .digest("hex");
}

export class TreeService {
  /**
   * Authoritative, idempotent tree report submission.
   */
  public async submitTreeReport(
    userId: string,
    dto: SubmitTreeDTO,
    clientIp?: string
  ) {
    const fingerprint = computeSubmissionFingerprint(dto);

    // 1. Check existing tree by idempotencyKey
    const existing = await prisma.tree.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
      include: {
        species: { select: { id: true, commonName: true, scientificName: true } },
        media: { select: { id: true, storageKey: true, mediaType: true, capturedAt: true } },
      },
    });

    if (existing) {
      // Replay verification rules
      if (existing.ownerId !== userId) {
        throw new ConflictError("Idempotency key owned by another user");
      }
      if (existing.idempotencyFingerprint !== fingerprint) {
        throw new ConflictError(
          "Submission payload differs from previous request with this idempotency key"
        );
      }
      return { tree: existing, isReplay: true };
    }

    // 2. Validate species exists and is active
    const species = await prisma.treeSpecies.findUnique({
      where: { id: dto.speciesId },
    });
    if (!species || !species.isActive) {
      throw new ValidationError("Tree species not found or is currently inactive");
    }

    // 3. Validate media upload intents and ownership
    for (const photo of dto.photos) {
      const intent = await prisma.mediaUploadIntent.findUnique({
        where: { storageKey: photo.storageKey },
      });

      if (!intent) {
        throw new ValidationError(`Media upload intent for ${photo.storageKey} does not exist`);
      }

      if (intent.userId !== userId) {
        throw new ForbiddenError(`You do not own the uploaded photo ${photo.storageKey}`);
      }

      if (intent.status !== "UPLOADED") {
        // If it's already ATTACHED, check if a concurrent submission with the same idempotencyKey won the race
        if (intent.status === "ATTACHED") {
          const concurrentTree = await prisma.tree.findUnique({
            where: { idempotencyKey: dto.idempotencyKey },
            include: {
              species: { select: { id: true, commonName: true, scientificName: true } },
              media: { select: { id: true, storageKey: true, mediaType: true, capturedAt: true } },
            },
          });
          if (concurrentTree) {
            if (concurrentTree.ownerId !== userId) {
              throw new ConflictError("Idempotency key owned by another user");
            }
            if (concurrentTree.idempotencyFingerprint !== fingerprint) {
              throw new ConflictError(
                "Submission payload differs from previous request with this idempotency key"
              );
            }
            return { tree: concurrentTree, isReplay: true };
          }
        }

        throw new ValidationError(
          `Photo ${photo.storageKey} is in ${intent.status} state. Upload must be completed before submission.`
        );
      }

      const fileExists = await storageService.exists(photo.storageKey);
      if (!fileExists) {
        throw new ValidationError(`Uploaded file for ${photo.storageKey} was not found on storage`);
      }
    }

    // 4. Transactional creation with P2002 race-condition safety
    try {
      const result = await prisma.$transaction(async (tx) => {
        const tree = await tx.tree.create({
          data: {
            ownerId: userId,
            speciesId: dto.speciesId,
            plantedAt: new Date(dto.plantedAt),
            latitude: dto.latitude,
            longitude: dto.longitude,
            locationAccuracy: dto.locationAccuracy,
            locationSource: "DEVICE_GPS",
            locationName: dto.locationName,
            context: dto.context,
            notes: dto.notes,
            idempotencyKey: dto.idempotencyKey,
            idempotencyFingerprint: fingerprint,
            status: "SUBMITTED",
            verificationStatus: "PENDING_VERIFICATION",
            media: {
              create: dto.photos.map((p) => ({
                storageKey: p.storageKey,
                mediaType: p.mediaType,
                capturedAt: p.capturedAt ? new Date(p.capturedAt) : null,
              })),
            },
          },
          include: {
            species: { select: { id: true, commonName: true, scientificName: true } },
            media: { select: { id: true, storageKey: true, mediaType: true, capturedAt: true } },
          },
        });

        // Mark upload intents as ATTACHED with concurrency-safe atomic update
        for (const photo of dto.photos) {
          const updateResult = await tx.mediaUploadIntent.updateMany({
            where: {
              storageKey: photo.storageKey,
              userId,
              status: "UPLOADED",
            },
            data: {
              status: "ATTACHED",
              attachedAt: new Date(),
            },
          });

          if (updateResult.count === 0) {
            throw new ConflictError(
              `Media upload intent for ${photo.storageKey} is not in UPLOADED state or has already been attached by another submission`
            );
          }
        }

        // Record Audit Log (Notice: zero GPS coordinates in details)
        await tx.auditLog.create({
          data: {
            userId,
            action: "TREE_SUBMITTED",
            details: JSON.stringify({
              treeId: tree.id,
              speciesId: dto.speciesId,
              photoCount: dto.photos.length,
            }),
            ipAddress: clientIp || null,
          },
        });

        return tree;
      });

      return { tree: result, isReplay: false };
    } catch (err: any) {
      // Catch concurrent unique constraint violation on idempotencyKey
      if (err.code === "P2002" && err.meta?.target?.includes("idempotencyKey")) {
        const raceExisting = await prisma.tree.findUnique({
          where: { idempotencyKey: dto.idempotencyKey },
          include: {
            species: { select: { id: true, commonName: true, scientificName: true } },
            media: { select: { id: true, storageKey: true, mediaType: true, capturedAt: true } },
          },
        });

        if (raceExisting) {
          if (raceExisting.ownerId !== userId) {
            throw new ConflictError("Idempotency key owned by another user");
          }
          if (raceExisting.idempotencyFingerprint !== fingerprint) {
            throw new ConflictError(
              "Submission payload differs from previous request with this idempotency key"
            );
          }
          return { tree: raceExisting, isReplay: true };
        }
      }
      throw err;
    }
  }

  /**
   * Retrieves authenticated user's tree journal.
   * Planters receive exact coordinates for their own trees.
   */
  public async getMyTrees(userId: string) {
    const trees = await prisma.tree.findMany({
      where: { ownerId: userId },
      include: {
        species: {
          select: { id: true, commonName: true, scientificName: true },
        },
        media: {
          select: { id: true, storageKey: true, mediaType: true, capturedAt: true },
        },
      },
      orderBy: { plantedAt: "desc" },
    });

    return trees.map((t) => ({
      id: t.id,
      species: t.species,
      plantedAt: t.plantedAt,
      latitude: t.latitude,
      longitude: t.longitude,
      locationAccuracy: t.locationAccuracy,
      locationSource: t.locationSource,
      locationName: t.locationName,
      context: t.context,
      notes: t.notes,
      idempotencyKey: t.idempotencyKey,
      status: t.status,
      verificationStatus: t.verificationStatus,
      createdAt: t.createdAt,
      media: t.media,
    }));
  }

  /**
   * Retrieves single tree with strict public visibility and role-based privacy projection.
   */
  public async getTreeById(
    treeId: string,
    callerUserId?: string,
    isOperator: boolean = false
  ) {
    const tree = await prisma.tree.findUnique({
      where: { id: treeId },
      include: {
        species: {
          select: { id: true, commonName: true, scientificName: true },
        },
        media: {
          select: { id: true, storageKey: true, mediaType: true, capturedAt: true },
        },
      },
    });

    if (!tree) {
      throw new NotFoundError("Tree record not found");
    }

    const isOwner = callerUserId && callerUserId === tree.ownerId;

    // Planters and authorized operators can access submitted evidence
    if (isOwner || isOperator) {
      return {
        id: tree.id,
        species: tree.species,
        plantedAt: tree.plantedAt,
        latitude: tree.latitude,
        longitude: tree.longitude,
        locationAccuracy: tree.locationAccuracy,
        locationSource: tree.locationSource,
        locationName: tree.locationName,
        context: tree.context,
        notes: tree.notes,
        idempotencyKey: tree.idempotencyKey,
        status: tree.status,
        verificationStatus: tree.verificationStatus,
        createdAt: tree.createdAt,
        updatedAt: tree.updatedAt,
        media: tree.media,
        isOwner: Boolean(isOwner),
      };
    }

    // Public / third-party caller:
    // STRICT RULE: Unverified trees (PENDING_VERIFICATION or REJECTED) are NOT visible to the public!
    if (tree.status !== "SUBMITTED" || tree.verificationStatus !== "VERIFIED") {
      throw new NotFoundError("Tree record not found or is pending verification");
    }

    // Explicit Public DTO Projection:
    // NEVER leak exact coordinates, locationAccuracy, planter notes, ownerId, or idempotency keys
    const obfuscated = obfuscateCoordinates(tree.latitude, tree.longitude);
    return {
      id: tree.id,
      species: tree.species,
      plantedAt: tree.plantedAt,
      latitude: obfuscated.latitude,
      longitude: obfuscated.longitude,
      locationAccuracy: null,
      locationSource: tree.locationSource,
      locationName: tree.locationName,
      context: tree.context,
      status: tree.status,
      verificationStatus: tree.verificationStatus,
      createdAt: tree.createdAt,
      media: tree.media.map((m) => ({
        id: m.id,
        mediaType: m.mediaType,
        capturedAt: m.capturedAt,
      })),
      isOwner: false,
    };
  }

  /**
   * Authoritative transition of tree verification status.
   * Logs a VerificationEvent and triggers AchievementEvaluator transactionally.
   */
  public async transitionVerificationStatus(
    treeId: string,
    newStatus: VerificationStatus,
    reviewerId: string,
    reason?: string
  ) {
    const existing = await prisma.tree.findUnique({
      where: { id: treeId },
    });

    if (!existing) {
      throw new NotFoundError("Tree not found");
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedTree = await tx.tree.update({
        where: { id: treeId },
        data: {
          verificationStatus: newStatus,
        },
      });

      await tx.verificationEvent.create({
        data: {
          treeId,
          previousStatus: existing.verificationStatus,
          newStatus,
          reviewerId,
          reason: reason || null,
        },
      });

      // If transitioning to VERIFIED, transactionally evaluate achievements
      let newlyUnlocked: Array<{ id: string; key: string; name: string }> = [];
      if (newStatus === VerificationStatus.VERIFIED) {
        const evalResult = await achievementService.evaluateUserAchievements(
          existing.ownerId,
          tx
        );
        newlyUnlocked = evalResult.newlyUnlocked;
      }

      return {
        tree: updatedTree,
        newlyUnlocked,
      };
    });

    return result;
  }
}

export const treeService = new TreeService();
