import fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import { loggerOptions } from "./shared/observability/logger.js";
import { errorHandler } from "./shared/middleware/error-handler.js";
import { initializeDatabase, prisma } from "./shared/database/prisma.js";
import { successResponse } from "./shared/types/api.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { userRoutes } from "./modules/users/users.routes.js";
import { speciesRoutes } from "./modules/species/species.routes.js";
import { mediaRoutes } from "./modules/media/media.routes.js";
import { treeRoutes } from "./modules/trees/tree.routes.js";
import { achievementRoutes } from "./modules/achievements/achievement.routes.js";
import { gpgRoutes } from "./modules/achievements/gpg.routes.js";

export async function buildApp(): Promise<FastifyInstance> {
  const app = fastify({
    logger: loggerOptions,
    requestIdHeader: "x-request-id",
  });

  // Centralized Error Handler
  app.setErrorHandler(errorHandler);

  // Cross-Origin Resource Sharing
  await app.register(cors, {
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  // JWT Registration
  await app.register(jwt, {
    secret: process.env.JWT_SECRET || "groveveil-dev-secret-change-in-production-2026",
  });

  // Global Rate Limiting Foundation
  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
    errorResponseBuilder: (_req, context) => ({
      success: false,
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: `Too many requests. Limit is ${context.max} requests per ${context.after}.`,
      },
      meta: { timestamp: new Date().toISOString() },
    }),
  });

  // Ensure DB pragmas are initialized
  await initializeDatabase();

  // Versioned API v1 Router
  await app.register(
    async (v1) => {
      // Health check endpoint
      v1.get("/health", async (request, reply) => {
        let dbStatus = "connected";
        try {
          await prisma.$queryRawUnsafe("SELECT 1;");
        } catch (err: any) {
          dbStatus = `disconnected: ${err.message}`;
          request.log.error({ err }, "Database health check failed");
        }

        const isHealthy = dbStatus === "connected";
        return reply.status(isHealthy ? 200 : 503).send(
          successResponse(
            {
              status: isHealthy ? "healthy" : "degraded",
              service: "groveveil-api",
              version: "0.1.0",
              environment: process.env.NODE_ENV || "development",
              database: dbStatus,
              uptimeSeconds: Math.floor(process.uptime()),
            },
            { requestId: request.id }
          )
        );
      });

      // Domain modules
      await v1.register(authRoutes, { prefix: "/auth" });
      await v1.register(userRoutes);
      await v1.register(speciesRoutes);
      await v1.register(mediaRoutes);
      await v1.register(treeRoutes);
      await v1.register(achievementRoutes);
      await v1.register(gpgRoutes);
    },
    { prefix: "/api/v1" }
  );

  return app;
}
