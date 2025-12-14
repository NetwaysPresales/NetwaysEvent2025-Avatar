# Setup Guide - Database Foundation

## What We've Completed

✅ **Step 1: Dependencies Installed**
- `pg` - PostgreSQL client
- `@azure/keyvault-secrets` - Azure Key Vault integration
- `@azure/identity` - Azure authentication
- `next-auth` - Authentication framework
- `@upstash/ratelimit` & `@upstash/redis` - Rate limiting
- `zod` - Schema validation
- `tsx` - TypeScript execution

✅ **Step 2: Core Modules Created**
- `src/lib/secrets.ts` - Secret management with Key Vault support
- `src/lib/db.ts` - Database connection pool and transaction support

✅ **Step 3: Database Schema (Prisma)**
- `prisma/schema.prisma` - Complete Prisma schema with all models
- `scripts/test-db-connection.ts` - Connection test script
- Prisma Client for type-safe database access

## Next Steps

### 1. Set Up Environment Variables

Create a `.env.local` file in the root directory with:

```env
# Database (REQUIRED)
DATABASE_URL=postgresql://user:password@host:5432/dbname

# For testing, you can use a local PostgreSQL or Azure Database
```

### 2. Test Database Connection

```bash
npm run test:db
```

This will:
- Test the database connection
- Check if tables exist
- Verify UUID extension

### 3. Generate Prisma Client

First, generate the Prisma Client (TypeScript types):

```bash
npm run db:generate
```

### 4. Run Database Migration

Once Prisma Client is generated:

```bash
npm run db:migrate
```

This will:
- Create a migration file
- Apply it to your database
- Create all required tables

### 5. Verify Migration

Run the test again to see the created tables:

```bash
npm run test:db
```

Or open Prisma Studio to view your database:

```bash
npm run db:studio
```

## What's Next?

After database setup is complete, we'll move on to:
1. Authentication module (NextAuth)
2. Middleware for route protection
3. API route refactoring

## Troubleshooting

**Connection Error?**
- Verify `DATABASE_URL` is correct
- Check database is running and accessible
- Ensure firewall rules allow your IP (for Azure)

**Migration Errors?**
- Make sure you have CREATE TABLE permissions
- Check if tables already exist (errors are safe to ignore)
- Verify PostgreSQL version is 14+

**Key Vault Errors?**
- Key Vault is optional - it will fall back to environment variables
- Only needed if `AZURE_KEY_VAULT_URL` is set

