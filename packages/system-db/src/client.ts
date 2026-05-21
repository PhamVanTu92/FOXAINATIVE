import { PrismaClient } from '.prisma/system-client';

const globalForPrisma = globalThis as unknown as {
  systemPrisma: PrismaClient | undefined;
};

export const systemPrisma =
  globalForPrisma.systemPrisma ??
  new PrismaClient({
    log: process.env['NODE_ENV'] === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.systemPrisma = systemPrisma;
}
