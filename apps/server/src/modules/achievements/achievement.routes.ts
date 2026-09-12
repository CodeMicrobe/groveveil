import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { authenticate } from "../auth/auth.middleware.js";
import { achievementService } from "./achievement.service.js";
import { successResponse } from "../../shared/types/api.js";

export const achievementRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Current Authenticated User's Milestone Achievements and Progress
  fastify.get(
    "/achievements",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const data = await achievementService.getUserAchievements(request.user.id);
      return reply.status(200).send(successResponse(data, { requestId: request.id }));
    }
  );
};
