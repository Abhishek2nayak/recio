/**
 * Single Prisma client for the process. Cached on `globalThis` so `tsx watch`
 * hot-reloads don't leak connections by constructing a new client each reload.
 */
import { PrismaClient } from "@prisma/client";
import { isProd } from "../config/env.js";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProd ? ["error"] : ["warn", "error"],
  });

if (!isProd) globalForPrisma.prisma = prisma;
