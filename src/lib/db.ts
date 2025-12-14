import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function getPrismaClient(): PrismaClient {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }

  // DATABASE_URL is set via Azure App Service Configuration or .env.local
  // Azure App Service automatically injects environment variables at runtime
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. ' +
      'Set it in Azure App Service Configuration (production) or .env.local (development).'
    );
  }

  const pool = new Pool({
    connectionString: url,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  const client = new PrismaClient({
    adapter: new PrismaPg(pool),
    // Only log errors and warnings - explicitly exclude 'query' and 'info'
    log: process.env.NODE_ENV === 'development' 
      ? ['error', 'warn'] 
      : ['error'],
  });

  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = client;
  }

  return client;
}

// Create a proxy that handles async initialization
export const db = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return (getPrismaClient() as any)[prop];
  },
});

/**
 * Close the database connection
 */
export async function closeDb(): Promise<void> {
  await db.$disconnect();
}

/**
 * Execute a transaction
 * 
 * @param callback - Function that receives Prisma client and performs operations
 * @returns Result of the callback
 */
export async function transaction<T>(
  callback: (tx: PrismaClient) => Promise<T>
): Promise<T> {
  return await db.$transaction(callback);
}
