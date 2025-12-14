// Prisma 7 config for migrations
// In production (Azure App Service), DATABASE_URL is set via environment variables
// In development, it's loaded from .env.local

// Try to load .env.local for development (won't exist in production)
try {
  require('dotenv').config({ path: '.env.local' });
} catch {
  // .env.local doesn't exist - that's fine, use environment variables
}

// DATABASE_URL must be set via environment variable (Azure App Service or .env.local)
if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. ' +
    'Set it in Azure App Service Configuration (production) or .env.local (development).'
  );
}

module.exports = {
  datasource: {
    url: process.env.DATABASE_URL,
  },
};

