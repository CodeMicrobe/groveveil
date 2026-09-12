import type { FastifyServerOptions } from "fastify";

/**
 * Structured logger options with security redaction.
 * Ensures that credentials, tokens, PII, exact coordinates, and private photos
 * are NEVER emitted into logs.
 */
export const loggerOptions: FastifyServerOptions["logger"] = {
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug"),
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.body.idToken",
      "req.body.accessToken",
      "req.body.refreshToken",
      "req.body.password",
      "req.body.email",
      "req.body.latitude",
      "req.body.longitude",
      "req.body.locationAccuracy",
      "body.idToken",
      "body.accessToken",
      "body.refreshToken",
      "body.password",
      "body.email",
      "body.latitude",
      "body.longitude",
      "body.locationAccuracy",
      "*.idToken",
      "*.accessToken",
      "*.refreshToken",
      "*.serverAuthCode",
      "*.encryptedRefreshToken",
      "*.latitude",
      "*.longitude",
      "*.locationAccuracy",
    ],
    censor: "[REDACTED]",
  },
  serializers: {
    req(req) {
      return {
        method: req.method,
        url: req.url,
        path: req.routeOptions?.url || req.url,
        parameters: req.params,
        requestId: req.id,
      };
    },
    res(res) {
      return {
        statusCode: res.statusCode,
      };
    },
  },
};
