import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { authenticate } from "../auth/auth.middleware.js";
import { validateRequest } from "../../shared/middleware/validate.js";
import { googlePlayGamesService } from "./gpg.service.js";
import { successResponse } from "../../shared/types/api.js";

const linkGpgSchema = z.object({
  serverAuthCode: z.string().min(1, "Server authorization code is required"),
});

export const gpgRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Link Google Play Games Account using Server Auth Code
  fastify.post(
    "/integrations/google-play-games/link",
    {
      preHandler: [authenticate, validateRequest({ body: linkGpgSchema })],
    },
    async (request, reply) => {
      const { serverAuthCode } = request.body as { serverAuthCode: string };
      const result = await googlePlayGamesService.linkAccount(
        request.user.id,
        serverAuthCode
      );
      return reply.status(200).send(successResponse(result, { requestId: request.id }));
    }
  );

  // Unlink Google Play Games Account
  fastify.delete(
    "/integrations/google-play-games/link",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const result = await googlePlayGamesService.unlinkAccount(request.user.id);
      return reply.status(200).send(successResponse(result, { requestId: request.id }));
    }
  );

  // Get Current Link Status
  fastify.get(
    "/integrations/google-play-games/status",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const result = await googlePlayGamesService.getStatus(request.user.id);
      return reply.status(200).send(successResponse(result, { requestId: request.id }));
    }
  );
};
