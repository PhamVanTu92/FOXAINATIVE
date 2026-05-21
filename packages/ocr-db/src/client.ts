import { PrismaClient } from '.prisma/ocr-client';

const globalForPrisma = globalThis as unknown as {
  ocrPrisma: PrismaClient | undefined;
};

export const ocrPrisma =
  globalForPrisma.ocrPrisma ??
  new PrismaClient({
    log: process.env['NODE_ENV'] === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.ocrPrisma = ocrPrisma;
}
