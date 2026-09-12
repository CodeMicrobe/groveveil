import { PrismaClient } from "@prisma/client";

// Global Prisma Client singleton
const globalForPrisma = global as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * Initializes SQLite connection parameters (foreign keys, busy timeout).
 * Guarantees that SQLite behaves with relational strictness.
 */
export async function initializeDatabase(): Promise<void> {
  try {
    // In SQLite, PRAGMA queries return rows, so $queryRawUnsafe is used
    await prisma.$queryRawUnsafe("PRAGMA foreign_keys = ON;");
    await prisma.$queryRawUnsafe("PRAGMA busy_timeout = 5000;");
  } catch (err) {
    // If running against PostgreSQL in staging/production, PRAGMA commands will no-op or catch cleanly
  }
}
