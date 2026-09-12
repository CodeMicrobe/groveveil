import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/app.js";
import { requireOwnership } from "../src/shared/middleware/authorize.js";
import { UserRole } from "@prisma/client";
import type { FastifyInstance } from "fastify";

describe("Authorization Boundary (Resource Ownership Guard)", () => {
  let app: FastifyInstance;
  let userAToken: string;
  let userBToken: string;

  beforeAll(async () => {
    app = await buildApp();

    // Register a test endpoint protected by requireOwnership
    app.get(
      "/api/v1/test/resources/:ownerId",
      {
        preHandler: [
          async (req, reply) => {
            const authHeader = req.headers.authorization;
            if (authHeader === "Bearer token-user-A") {
              req.user = {
                id: "user-A",
                email: "a@test.com",
                displayName: "User A",
                publicHandle: "user_a",
                status: "ACTIVE",
                role: UserRole.USER,
              };
            } else if (authHeader === "Bearer token-user-B") {
              req.user = {
                id: "user-B",
                email: "b@test.com",
                displayName: "User B",
                publicHandle: "user_b",
                status: "ACTIVE",
                role: UserRole.USER,
              };
            } else {
              reply.status(401).send({ error: "Unauthorized" });
            }
          },
          requireOwnership(async (req) => (req.params as any).ownerId),
        ],
      },
      async (_req, reply) => {
        return reply.status(200).send({ success: true, message: "Ownership verified" });
      }
    );

    await app.ready();
    userAToken = "token-user-A";
    userBToken = "token-user-B";
  });

  afterAll(async () => {
    await app.close();
  });

  it("allows user A to access their own resource", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/test/resources/user-A",
      headers: { authorization: `Bearer ${userAToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
  });

  it("blocks user B from accessing user A's resource with 403 FORBIDDEN", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/test/resources/user-A",
      headers: { authorization: `Bearer ${userBToken}` },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("FORBIDDEN");
  });
});
