import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/app.js";
import type { FastifyInstance } from "fastify";

describe("API Health Endpoint", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns 200 OK and connected database status", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/health",
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe("healthy");
    expect(body.data.service).toBe("groveveil-api");
    expect(body.data.database).toBe("connected");
    expect(body.meta).toHaveProperty("timestamp");
    expect(body.meta).toHaveProperty("requestId");
  });
});
