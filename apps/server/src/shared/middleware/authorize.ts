import type { FastifyRequest, FastifyReply } from "fastify";

/**
 * Authorization Boundary: Resource Ownership Guard.
 * Strictly verifies that the authenticated user owns the resource being accessed/mutated.
 * Prevents horizontal privilege escalation.
 */
export function requireOwnership(
  getOwnerId: (request: FastifyRequest) => Promise<string | null | undefined>
) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      reply.status(401).send({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
        meta: { timestamp: new Date().toISOString(), requestId: request.id },
      });
      return;
    }

    const ownerId = await getOwnerId(request);
    if (!ownerId) {
      reply.status(404).send({
        success: false,
        error: { code: "NOT_FOUND", message: "Resource not found" },
        meta: { timestamp: new Date().toISOString(), requestId: request.id },
      });
      return;
    }

    if (request.user.id !== ownerId) {
      reply.status(403).send({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "You do not have permission to access or modify this resource",
        },
        meta: { timestamp: new Date().toISOString(), requestId: request.id },
      });
      return;
    }
  };
}

/**
 * Authorization Boundary: Role Guard.
 * Strictly verifies that the authenticated user possesses the required role (e.g. OPERATOR).
 */
export function requireRole(requiredRole: import("@prisma/client").UserRole) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      reply.status(401).send({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
        meta: { timestamp: new Date().toISOString(), requestId: request.id },
      });
      return;
    }

    if (request.user.role !== requiredRole) {
      reply.status(403).send({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Insufficient permissions for this operation",
        },
        meta: { timestamp: new Date().toISOString(), requestId: request.id },
      });
      return;
    }
  };
}

