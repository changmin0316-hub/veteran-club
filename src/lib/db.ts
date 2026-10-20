import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Neon 풀링(PgBouncer) 사용 시 prepared statement 충돌(간헐적 500) 방지:
// pgbouncer=true 플래그를 런타임에 강제로 붙인다.
function runtimeUrl(): string | undefined {
  const u = process.env.DATABASE_URL;
  if (!u) return u;
  if (u.includes("pgbouncer=true")) return u;
  return u + (u.includes("?") ? "&" : "?") + "pgbouncer=true";
}

const url = runtimeUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(url ? { datasources: { db: { url } } } : {}),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
