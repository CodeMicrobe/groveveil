import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { errorResponse } from "../types/api.js";

export function errorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  const requestId = request.id;

  // Handle Zod Schema Validation Errors
  if (error instanceof ZodError) {
    request.log.warn({ err: error, requestId }, "Request validation failed");
    reply.status(400).send(
      errorResponse(
        "VALIDATION_ERROR",
        "Invalid request parameters",
        error.errors.map((e) => ({
          field: e.path.join("."),
          message: e.message,
          code: e.code,
        })),
        { requestId }
      )
    );
    return;
  }

  // Handle Prisma Database Errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      request.log.warn({ err: error, requestId }, "Unique constraint violation");
      reply.status(409).send(
        errorResponse(
          "CONFLICT",
          "A resource with these details already exists",
          { target: error.meta?.target },
          { requestId }
        )
      );
      return;
    }
    if (error.code === "P2025") {
      reply.status(404).send(
        errorResponse("NOT_FOUND", "The requested record was not found", undefined, { requestId })
      );
      return;
    }
  }

  // Handle Fastify HTTP Errors & Custom Domain Errors
  const statusCode = (error as any).statusCode || 500;
  const errorCode = (error as any).code || "INTERNAL_SERVER_ERROR";

  if (statusCode >= 500) {
    request.log.error({ err: error, requestId }, "Server error occurred");
    const message =
      (error as any).code === "AUTH_NOT_CONFIGURED"
        ? error.message
        : "An unexpected error occurred. Please try again later.";

    reply.status(statusCode).send(
      errorResponse(errorCode, message, undefined, { requestId })
    );
  } else {
    request.log.warn({ err: error, requestId }, "Client error occurred");
    reply.status(statusCode).send(
      errorResponse(errorCode, error.message || "Request failed", undefined, { requestId })
    );
  }
}
