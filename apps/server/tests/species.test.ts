import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/shared/database/prisma.js";
import type { FastifyInstance } from "fastify";

describe("Species Catalogue & Search API", () => {
  let app: FastifyInstance;
  let activeSpeciesId: string;
  let inactiveSpeciesId: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    // Create an active test species with aliases
    const activeSpecies = await prisma.treeSpecies.create({
      data: {
        commonName: "Neem Test",
        scientificName: "Azadirachta indica test",
        isActive: true,
        aliases: {
          create: [
            { alias: "Indian Lilac Test", language: "en" },
            { alias: "Vepa Test", language: "te" },
          ],
        },
      },
    });
    activeSpeciesId = activeSpecies.id;

    // Create an inactive test species
    const inactiveSpecies = await prisma.treeSpecies.create({
      data: {
        commonName: "Extinct Ghost Tree",
        scientificName: "Ghostus extinctus",
        isActive: false,
        aliases: {
          create: [{ alias: "Phantom Tree", language: "en" }],
        },
      },
    });
    inactiveSpeciesId = inactiveSpecies.id;
  });

  afterAll(async () => {
    await prisma.treeSpeciesAlias.deleteMany({
      where: { speciesId: { in: [activeSpeciesId, inactiveSpeciesId] } },
    });
    await prisma.treeSpecies.deleteMany({
      where: { id: { in: [activeSpeciesId, inactiveSpeciesId] } },
    });
    await app.close();
  });

  it("lists all active tree species with aliases", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/species",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);

    const neem = body.data.find((s: any) => s.id === activeSpeciesId);
    expect(neem).toBeDefined();
    expect(neem.commonName).toBe("Neem Test");
    expect(neem.aliases).toContain("Indian Lilac Test");

    const ghost = body.data.find((s: any) => s.id === inactiveSpeciesId);
    expect(ghost).toBeUndefined(); // Inactive species must be excluded
  });

  it("searches species by commonName", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/species?q=Neem",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    const found = body.data.find((s: any) => s.id === activeSpeciesId);
    expect(found).toBeDefined();
  });

  it("searches species by scientificName", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/species?q=Azadirachta",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    const found = body.data.find((s: any) => s.id === activeSpeciesId);
    expect(found).toBeDefined();
  });

  it("searches species by normalized aliases", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/species?q=Vepa",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    const found = body.data.find((s: any) => s.id === activeSpeciesId);
    expect(found).toBeDefined();
  });

  it("retrieves a species by ID", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/species/${activeSpeciesId}`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(activeSpeciesId);
    expect(body.data.commonName).toBe("Neem Test");
    expect(body.data.aliases).toContain("Vepa Test");
  });

  it("returns 404 for nonexistent species ID", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/species/00000000-0000-0000-0000-000000000000",
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
  });
});
