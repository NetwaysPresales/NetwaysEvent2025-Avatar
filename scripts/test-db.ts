/**
 * Database Connection Test
 * Usage: npm run test:db
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

async function testDatabase() {
  console.log('🔍 Testing Database Connection\n');

  // Check DATABASE_URL exists
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL is not set in .env.local');
    process.exit(1);
  }

  // Parse connection string
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(dbUrl);
    console.log('📋 Connection string parsed:');
    console.log(`  Host: ${parsedUrl.hostname}`);
    console.log(`  Database: ${parsedUrl.pathname.slice(1) || '(not specified)'}`);
    console.log(`  Username: ${parsedUrl.username ? decodeURIComponent(parsedUrl.username) : '(not specified)'}`);
  } catch (error: any) {
    console.error('❌ Invalid connection string format:', error.message);
    process.exit(1);
  }

  // Test basic connection
  console.log('\n🔌 Testing basic connection...');
  const { Pool } = await import('pg');
  const usernameWithServer = decodeURIComponent(parsedUrl.username);
  const usernameOnly = usernameWithServer.split('@')[0];

  const createPool = (user: string) => new Pool({
    host: parsedUrl.hostname,
    port: parseInt(parsedUrl.port || '5432'),
    database: parsedUrl.pathname.slice(1) || 'postgres',
    user,
    password: parsedUrl.password,
    ssl: parsedUrl.searchParams.get('sslmode') === 'require' ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10000,
  });

  try {
    const pool = createPool(usernameWithServer);
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    await client.release();
    await pool.end();
    console.log('✓ Basic connection successful');
  } catch (error: any) {
    if (error.message?.includes('authentication') && usernameWithServer.includes('@')) {
      console.log('  Trying username-only format...');
      try {
        const pool = createPool(usernameOnly);
        const client = await pool.connect();
        await client.query('SELECT NOW()');
        await client.release();
        await pool.end();
        console.log('✓ Basic connection successful (username-only format)');
        console.log(`\n  💡 Use: postgresql://${usernameOnly}:password@${parsedUrl.hostname}:${parsedUrl.port || '5432'}/${parsedUrl.pathname.slice(1)}?sslmode=require`);
      } catch {
        console.error('❌ Basic connection failed');
        process.exit(1);
      }
    } else {
      console.error('❌ Basic connection failed:', error.message);
      process.exit(1);
    }
  }

  // Test Prisma connection
  console.log('\n🔧 Testing Prisma connection...');
  try {
    const { db, closeDb } = await import('../src/lib/db');
    
    const result = await db.$queryRaw<Array<{ now: Date; version: string }>>`
      SELECT NOW() as now, version() as version
    `;
    console.log('✓ Prisma connection successful');
    console.log(`  PostgreSQL version: ${result[0].version.split(' ')[0]} ${result[0].version.split(' ')[1]}`);

    // Check tables
    const tables = await db.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `;

    if (tables.length === 0) {
      console.log('\n⚠ No tables found. Run: npx prisma db push');
    } else {
      console.log(`\n✓ Found ${tables.length} tables`);
    }

    // Test Prisma Client
    try {
      const userCount = await db.user.count();
      console.log(`✓ Prisma Client working (${userCount} users)`);
    } catch (error: any) {
      if (error.message?.includes('does not exist')) {
        console.log('⚠ Tables not created yet. Run: npx prisma db push');
      } else {
        throw error;
      }
    }

    await closeDb();
    console.log('\n✅ All tests passed!');
  } catch (error: any) {
    console.error('❌ Prisma test failed:', error.message);
    process.exit(1);
  }
}

testDatabase().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

