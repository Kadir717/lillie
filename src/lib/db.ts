/**
 * Prisma client singleton.
 *
 * In development, Next.js hot-reload can create multiple PrismaClient
 * instances. The globalThis pattern prevents this by reusing the same
 * instance across module reloads.
 *
 * Import this module wherever you need to query the database:
 *   import { prisma } from "@/lib/db";
 *
 * ── Connection Configuration ─────────────────────────────────────
 * The DATABASE_URL environment variable determines the database:
 *
 *   Local development:
 *     DATABASE_URL="file:./dev.db"
 *
 *   Production (Turso):
 *     DATABASE_URL="libsql://your-db.turso.io?authToken=..."
 *     (Requires @prisma/adapter-libsql driver adapter — see Turso docs)
 *
 *   Future PostgreSQL:
 *     DATABASE_URL="postgresql://user:password@host:5432/db"
 *     (Just change the provider in prisma/schema.prisma)
 */

import { PrismaClient } from "@prisma/client";
import { validateEnv } from "./env";

// Validate critical environment variables at module import time.
// In production, missing vars throw immediately. In development, warnings.
validateEnv();

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
