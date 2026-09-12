import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { AuthService } from "./auth.service.js";
import { googleLoginSchema, refreshTokenSchema, logoutSchema } from "./auth.schemas.js";
import { googleAuthVerifier } from "./google-verifier.js";
import { successResponse } from "../../shared/types/api.js";
import { authenticate } from "./auth.middleware.js";

export const authRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const authService = new AuthService(fastify);

  // Status check for Auth configuration
  fastify.get("/status", async () => {
    return successResponse({
      googleConfigured: googleAuthVerifier.isConfigured(),
      provider: "google",
      status: "ready",
    });
  });

  // Google Sign-In / Registration
  fastify.post("/google", async (request, reply) => {
    const parsed = googleLoginSchema.parse(request.body);
    const userAgent = request.headers["user-agent"];
    const result = await authService.loginWithGoogle(parsed.idToken, request.ip, userAgent);
    return reply.status(200).send(successResponse(result, { requestId: request.id }));
  });

  // Token Refresh with Refresh Token Rotation
  fastify.post("/refresh", async (request, reply) => {
    const parsed = refreshTokenSchema.parse(request.body);
    const result = await authService.refreshToken(parsed.refreshToken);
    return reply.status(200).send(successResponse(result, { requestId: request.id }));
  });

  // Authoritative Logout & Session Revocation
  fastify.post("/logout", { preHandler: [authenticate] }, async (request, reply) => {
    const parsed = logoutSchema.parse(request.body || {});
    await authService.logout(request.user!.id, parsed.refreshToken);
    return reply.status(200).send(
      successResponse(
        { message: "Session successfully revoked and logged out" },
        { requestId: request.id }
      )
    );
  });
};
