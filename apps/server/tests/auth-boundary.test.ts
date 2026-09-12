import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/app.js";
import type { FastifyInstance } from "fastify";

describe("Authentication Boundary", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("reports Google credential configuration status honestly", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/auth/status",
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(typeof body.data.googleConfigured).toBe("boolean");
  });

  it("rejects unverified Google tokens without faking success (401 or 503)", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/google",
      payload: {
        idToken: "sample-unverified-google-id-token-xyz123",
      },
    });

    expect([401, 503]).toContain(response.statusCode);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
    expect(["AUTH_NOT_CONFIGURED", "INVALID_TOKEN"]).toContain(body.error.code);
  });

  it("explicitly rejects the mobile placeholder token 'mock_or_device_id_token' and prevents bypass", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/google",
      payload: {
        idToken: "mock_or_device_id_token",
      },
    });

    // Must never succeed or issue a session
    expect(response.statusCode).toBeGreaterThanOrEqual(400);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
    expect(["AUTH_NOT_CONFIGURED", "INVALID_TOKEN"]).toContain(body.error.code);
  });

  it("rejects protected endpoint /api/v1/me when no token is provided", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/me",
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects protected endpoint /api/v1/me when a forged token is provided", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/me",
      headers: {
        authorization: "Bearer forged-invalid-token-signature",
      },
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
  });
});
