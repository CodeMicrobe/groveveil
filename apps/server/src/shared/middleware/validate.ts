import type { FastifyRequest, FastifyReply } from "fastify";
import type { AnyZodObject } from "zod";

export interface ValidationSchemas {
  body?: AnyZodObject;
  query?: AnyZodObject;
  params?: AnyZodObject;
}

export function validateRequest(schemas: ValidationSchemas) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    if (schemas.body && request.body) {
      request.body = schemas.body.parse(request.body);
    }
    if (schemas.query && request.query) {
      request.query = schemas.query.parse(request.query);
    }
    if (schemas.params && request.params) {
      request.params = schemas.params.parse(request.params);
    }
  };
}
