import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { prisma } from "../../shared/database/prisma.js";
import { successResponse, errorResponse } from "../../shared/types/api.js";

export const speciesRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Active Tree Species Catalog with relational aliases and search
  fastify.get("/species", async (request, reply) => {
    const { q, search } = request.query as { q?: string; search?: string };
    const queryTerm = (q || search || "").trim();

    const whereClause: any = { isActive: true };
    if (queryTerm) {
      whereClause.OR = [
        { commonName: { contains: queryTerm } },
        { scientificName: { contains: queryTerm } },
        { aliases: { some: { alias: { contains: queryTerm } } } },
      ];
    }

    const species = await prisma.treeSpecies.findMany({
      where: whereClause,
      include: {
        aliases: {
          select: { alias: true, language: true },
        },
      },
      orderBy: { commonName: "asc" },
    });

    return reply.status(200).send(
      successResponse(
        species.map((s) => ({
          id: s.id,
          commonName: s.commonName,
          scientificName: s.scientificName,
          aliases: s.aliases.map((a) => a.alias),
        })),
        { requestId: request.id }
      )
    );
  });

  // Get Species by ID
  fastify.get("/species/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const species = await prisma.treeSpecies.findUnique({
      where: { id },
      include: {
        aliases: {
          select: { alias: true, language: true },
        },
      },
    });

    if (!species) {
      return reply.status(404).send(
        errorResponse("NOT_FOUND", "Tree species not found", undefined, { requestId: request.id })
      );
    }

    return reply.status(200).send(
      successResponse(
        {
          id: species.id,
          commonName: species.commonName,
          scientificName: species.scientificName,
          aliases: species.aliases.map((a) => a.alias),
        },
        { requestId: request.id }
      )
    );
  });
};
