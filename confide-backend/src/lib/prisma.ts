import { PrismaClient } from "@prisma/client";

// Single shared Prisma client. Postgres is the source of truth (Section 3) —
// every write that must survive a Redis flush goes through here.
export const prisma = new PrismaClient();
