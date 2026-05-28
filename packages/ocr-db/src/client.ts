import { PrismaClient } from '.prisma/ocr-client';

const globalForPrisma = globalThis as unknown as {
  ocrPrisma: PrismaClient | undefined;
};

const dbUrl = process.env['OCR_DATABASE_URL'];

export const ocrPrisma =
  globalForPrisma.ocrPrisma ??
  new PrismaClient({
    ...(dbUrl ? { datasources: { db: { url: dbUrl } } } : {}),
    log: process.env['NODE_ENV'] === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.ocrPrisma = ocrPrisma;
}
