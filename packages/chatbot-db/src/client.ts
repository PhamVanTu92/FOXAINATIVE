import { PrismaClient } from '.prisma/chatbot-client';

const globalForPrisma = globalThis as unknown as {
  chatbotPrisma: PrismaClient | undefined;
};

export const chatbotPrisma =
  globalForPrisma.chatbotPrisma ??
  new PrismaClient({
    log: process.env['NODE_ENV'] === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.chatbotPrisma = chatbotPrisma;
}
