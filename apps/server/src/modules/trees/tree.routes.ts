import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { authenticate, type AuthJwtPayload } from "../auth/auth.middleware.js";
import { UserRole } from "@prisma/client";
import { validateRequest } from "../../shared/middleware/validate.js";
import { successResponse, errorResponse } from "../../shared/types/api.js";
import { submitTreeSchema, type SubmitTreeDTO } from "./tree.schemas.js";
import {
  treeService,
  ConflictError,
  ValidationError,
  ForbiddenError,
  NotFoundError,
} from "./tree.service.js";

export const treeRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // 1. Submit Tree Report (Idempotent)
  fastify.post(
    "/trees",
    {
      preHandler: [authenticate, validateRequest({ body: submitTreeSchema })],
    },
    async (request, reply) => {
      try {
        const dto = request.body as SubmitTreeDTO;
        const result = await treeService.submitTreeReport(
          request.user.id,
          dto,
          request.ip
        );

        const statusCode = result.isReplay ? 200 : 201;
        return reply.status(statusCode).send(
          successResponse(
            {
              tree: result.tree,
              isReplay: result.isReplay,
            },
            {
              requestId: request.id,
              status: statusCode === 200 ? "idempotent_replay" : "created",
            }
          )
        );
      } catch (err: any) {
        if (err instanceof ConflictError) {
          return reply
            .status(409)
            .send(errorResponse("CONFLICT", err.message, undefined, { requestId: request.id }));
        }
        if (err instanceof ValidationError) {
          return reply
            .status(400)
            .send(errorResponse("VALIDATION_ERROR", err.message, undefined, { requestId: request.id }));
        }
        if (err instanceof ForbiddenError) {
          return reply
            .status(403)
            .send(errorResponse("FORBIDDEN", err.message, undefined, { requestId: request.id }));
        }
        if (err instanceof NotFoundError) {
          return reply
            .status(404)
            .send(errorResponse("NOT_FOUND", err.message, undefined, { requestId: request.id }));
        }
        throw err;
      }
    }
  );

  // 2. Get Authenticated User's Tree Journal (My Trees)
  fastify.get(
    "/trees/me",
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      const trees = await treeService.getMyTrees(request.user.id);
      return reply.status(200).send(
        successResponse(trees, { requestId: request.id })
      );
    }
  );

  // 3. Get Single Tree by ID (Role-based Location Privacy)
  fastify.get("/trees/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    let callerUserId: string | undefined;
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
        // Optional auth
      }
    }

    if (
      process.env.OPERATOR_API_KEY &&
      request.headers["x-operator-key"] === process.env.OPERATOR_API_KEY
    ) {
      isOperator = true;
    }

    try {
      const tree = await treeService.getTreeById(id, callerUserId, isOperator);
      return reply.status(200).send(
        successResponse(tree, { requestId: request.id })
      );
    } catch (err: any) {
      if (err instanceof NotFoundError) {
        return reply
          .status(404)
          .send(errorResponse("NOT_FOUND", err.message, undefined, { requestId: request.id }));
      }
      throw err;
    }
  });

  // 4. Operator Verification Transition (Atomic & Triggers Achievements)
  fastify.patch("/trees/:id/verification", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { status: string; reason?: string };

    let isOperator = false;
    let reviewerId = "operator_api_key";

    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const decoded = await request.jwtVerify<AuthJwtPayload>();
        if (decoded?.role === UserRole.OPERATOR) {
          isOperator = true;
          reviewerId = decoded.userId;
        }
      } catch {
        // Fall through
      }
    }

    if (
      process.env.OPERATOR_API_KEY &&
      request.headers["x-operator-key"] === process.env.OPERATOR_API_KEY
    ) {
      isOperator = true;
      reviewerId = "operator_api_key";
    }

    if (!isOperator) {
      return reply.status(403).send(
        errorResponse("FORBIDDEN", "Operator authorization required", undefined, {
          requestId: request.id,
        })
      );
    }

    if (!["PENDING_VERIFICATION", "VERIFIED", "REJECTED"].includes(body?.status)) {
      return reply.status(400).send(
        errorResponse(
          "VALIDATION_ERROR",
          "Status must be PENDING_VERIFICATION, VERIFIED, or REJECTED",
          undefined,
          { requestId: request.id }
        )
      );
    }

    try {
      const result = await treeService.transitionVerificationStatus(
        id,
        body.status as any,
        reviewerId,
        body.reason
      );

      return reply.status(200).send(
        successResponse(
          {
            treeId: result.tree.id,
            status: result.tree.status,
            verificationStatus: result.tree.verificationStatus,
            newlyUnlockedAchievements: result.newlyUnlocked,
          },
          { requestId: request.id }
        )
      );
    } catch (err: any) {
      if (err instanceof NotFoundError) {
        return reply.status(404).send(
          errorResponse("NOT_FOUND", err.message, undefined, { requestId: request.id })
        );
      }
      throw err;
    }
  });
};
