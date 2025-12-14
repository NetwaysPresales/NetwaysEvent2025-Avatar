# Comprehensive Implementation Plan

## Executive Summary

This document consolidates all critical analyses into a **detailed, step-by-step implementation plan** for migrating the avatar application to a multi-user, stateless, cloud-native architecture with Azure integration.

**Related Documents**:
- `CRITICAL_ANALYSIS.md` - Avatar setup, microphone, video handling issues
- `CRITICAL_ANALYSIS_PRESETS_APPEARANCE.md` - Preset/profile system issues
- `CRITICAL_ANALYSIS_AGENT.md` - LLM agent implementation issues
- `CRITICAL_ANALYSIS_UI.md` - UI implementation issues
- `ARCHITECTURE_MIGRATION_PLAN.md` - Migration architecture
- `AZURE_AI_SEARCH_ARCHITECTURE.md` - Vector search implementation
- `ENTITY_VISUALIZATION_SYSTEM.md` - Entity visualization system

---

## Part 1: Prerequisites & User Requirements

### 1.1 What Users Must Provide

**Azure Resources** (User must create these):
1. **Azure Subscription** with billing enabled
2. **Azure AD B2C Tenant** (or standard Azure AD) for authentication
3. **Azure OpenAI Resource** with:
   - Chat completion deployment (e.g., `gpt-4`, `gpt-35-turbo`)
   - Embedding deployment (`text-embedding-ada-002`)
4. **Azure Speech Service Resource** with:
   - Speech-to-text endpoint
   - Text-to-speech endpoint
   - Avatar service endpoint
5. **Azure AI Search Service** (Basic tier minimum, Standard recommended)
6. **Azure Storage Account** (Standard tier) for Blob Storage
7. **Azure Database for PostgreSQL** (or Azure SQL Database)
8. **Azure App Service Plan** (Linux, Node.js 20)

**API Keys & Credentials** (User must provide):
1. Azure OpenAI API key and endpoint
2. Azure Speech Service API key and region
3. Azure AI Search admin key and endpoint
4. Azure Storage connection string
5. Database connection string
6. Azure AD B2C application ID, secret, tenant ID
7. (Optional) Tavily API key for web search
8. (Optional) Upstash Redis URL and token (for rate limiting)
9. (Optional) Google Maps API key (for entity maps)

**Configuration Values** (User must configure):
1. Domain name for application (for NextAuth callback URLs)
2. CORS allowed origins
3. Session timeout duration
4. Rate limiting thresholds
5. File upload size limits
6. Blob Storage container names

---

## Part 2: Cloud Resources & Infrastructure

### 2.1 Azure Resources to Provision

**See `ARCHITECTURE_MIGRATION_PLAN.md` Section 7 for complete tech stack details.**

#### 2.1.1 Azure Database for PostgreSQL
- **Tier**: Basic (development) or General Purpose (production)
- **Version**: PostgreSQL 14 or higher
- **Storage**: Minimum 32GB, auto-grow enabled
- **Backup**: Point-in-time restore enabled
- **Connection**: Private endpoint (production) or public with firewall rules
- **Extensions Required**: `uuid-ossp` for UUID generation

#### 2.1.2 Azure Storage Account
- **Performance**: Standard
- **Replication**: LRS (development) or GRS (production)
- **Access Tier**: Hot
- **Containers to Create**:
  - `avatar-assets` (profile logos, backgrounds)
  - `entity-media` (entity images, videos)
  - `knowledge-files` (raw knowledge base files)
- **CORS Configuration**: Allow origin from App Service domain
- **Lifecycle Policies**: Archive old files after 90 days (optional)

#### 2.1.3 Azure AI Search
- **Tier**: Basic (up to 50MB) or Standard (up to 200GB)
- **Index Name**: `knowledge-base-index`
- **Vector Search**: Enabled with HNSW algorithm
- **API Version**: 2024-08-01-preview (for vector search support)

#### 2.1.4 Azure App Service
- **Runtime Stack**: Node.js 20 LTS
- **Operating System**: Linux
- **App Service Plan**: Basic B1 (dev) or Standard S1+ (production)
- **Always On**: Enabled (production)
- **HTTPS Only**: Enabled
- **Managed Identity**: Enabled (for Key Vault access)

#### 2.1.5 Azure Key Vault (Recommended)
- **Purpose**: Store sensitive secrets (API keys, connection strings)
- **Access Policy**: Grant App Service managed identity access
- **Secrets to Store**:
  - Database connection string
  - Azure OpenAI API key
  - Azure Speech API key
  - Azure AI Search admin key
  - Azure Storage connection string
  - Azure Storage account key
  - NextAuth secret
  - Azure AD B2C client secret
  - Google Maps API key (if used)
  - Upstash Redis token (if used)

#### 2.1.6 Upstash Redis (For Rate Limiting)
- **Purpose**: Rate limiting for API routes
- **Tier**: Free tier sufficient for development, paid for production
- **Configuration**: 
  - Create Redis database
  - Get REST URL and token
  - Add to environment variables

#### 2.1.7 Azure Application Insights
- **Purpose**: Monitoring and logging
- **Integration**: Enable in App Service
- **Logs to Collect**:
  - Application logs
  - Performance counters
  - Dependency tracking
  - Exception tracking

---

## Part 3: Secrets & Configuration Management

### 3.1 Environment Variables Structure

**Server-Side Only** (`.env.local` or Azure App Service Configuration):
```
# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Azure OpenAI
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_API_KEY=your-api-key
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-ada-002

# Azure Speech
AZURE_SPEECH_KEY=your-speech-key
AZURE_SPEECH_REGION=your-region

# Azure AI Search
AZURE_SEARCH_ENDPOINT=https://your-search.search.windows.net
AZURE_SEARCH_API_KEY=your-admin-key
AZURE_SEARCH_INDEX_NAME=knowledge-base-index

# Azure Storage
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=...

# Authentication
NEXTAUTH_SECRET=generate-random-secret-32-chars
NEXTAUTH_URL=https://yourapp.azurewebsites.net

# Azure AD B2C
AZURE_AD_B2C_CLIENT_ID=your-client-id
AZURE_AD_B2C_CLIENT_SECRET=your-client-secret
AZURE_AD_B2C_TENANT_ID=your-tenant-id
AZURE_AD_B2C_SIGNUP_SIGNIN_POLICY=B2C_1_signupsignin

# Optional
TAVILY_API_KEY=your-tavily-key
GOOGLE_MAPS_API_KEY=your-google-maps-key

# Rate Limiting (Upstash Redis)
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token
```

**Client-Side** (`.env.local` with `NEXT_PUBLIC_` prefix):
```
NEXT_PUBLIC_AZURE_SPEECH_REGION=your-region
NEXT_PUBLIC_APP_URL=https://yourapp.azurewebsites.net
```

### 3.2 Secret Storage Strategy

**Development**:
- Use `.env.local` file (gitignored)
- Never commit secrets to repository

**Production**:
- **Primary**: Azure Key Vault (recommended)
- **Fallback**: Azure App Service Configuration (encrypted at rest)
- **Never**: Environment variables in code, client-side code, or public repositories

**Implementation**:
```typescript
// lib/secrets.ts
import { SecretClient } from '@azure/keyvault-secrets';
import { DefaultAzureCredential } from '@azure/identity';

let secretCache: Map<string, string> = new Map();

export async function getSecret(secretName: string): Promise<string> {
  // Check cache first
  if (secretCache.has(secretName)) {
    return secretCache.get(secretName)!;
  }

  // Try Key Vault if configured
  if (process.env.AZURE_KEY_VAULT_URL) {
    try {
      const credential = new DefaultAzureCredential();
      const client = new SecretClient(process.env.AZURE_KEY_VAULT_URL, credential);
      const secret = await client.getSecret(secretName);
      secretCache.set(secretName, secret.value);
      return secret.value;
    } catch (error) {
      console.warn(`Failed to get secret from Key Vault: ${error}`);
    }
  }

  // Fallback to environment variable
  const envValue = process.env[secretName];
  if (!envValue) {
    throw new Error(`Secret ${secretName} not found`);
  }
  return envValue;
}
```

---

## Part 4: Database Schema & Migrations

### 4.1 Complete Database Schema

**See `ARCHITECTURE_MIGRATION_PLAN.md` Section 2.2 for full schema.**

#### 4.1.1 Core Tables

**Users Table**:
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  azure_ad_id VARCHAR(255) UNIQUE
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_azure_ad_id ON users(azure_ad_id);
```

**Profiles Table**:
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Configurations (JSONB)
  avatar_config JSONB NOT NULL,
  speech_config JSONB NOT NULL,
  tts_config JSONB NOT NULL,
  openai_config JSONB NOT NULL,
  stt_config JSONB NOT NULL,
  
  -- Appearance
  app_title VARCHAR(255),
  app_description TEXT,
  theme VARCHAR(20) DEFAULT 'light',
  accent_color JSONB, -- See CRITICAL_ANALYSIS_UI.md Section 9
  
  -- Asset references (Blob Storage URLs)
  logo_blob_url VARCHAR(500),
  background_blob_url VARCHAR(500),
  
  CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_profiles_created_at ON profiles(created_at);
```

**Knowledge Files Table**:
```sql
CREATE TABLE knowledge_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  blob_url VARCHAR(500) NOT NULL,
  azure_search_indexed BOOLEAN DEFAULT FALSE,
  chunk_count INTEGER DEFAULT 0,
  indexed_at TIMESTAMP WITH TIME ZONE,
  embedding_model VARCHAR(50) DEFAULT 'text-embedding-ada-002',
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT knowledge_files_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT knowledge_files_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_knowledge_files_user_profile ON knowledge_files(user_id, profile_id);
CREATE INDEX idx_knowledge_files_indexed ON knowledge_files(azure_search_indexed) WHERE azure_search_indexed = FALSE;
```

**Entity Tables** (See `ENTITY_VISUALIZATION_SYSTEM.md` Section 2):
```sql
-- Entity Templates
CREATE TABLE entity_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  structure JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT entity_templates_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT entity_templates_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT unique_template_name_per_profile UNIQUE (profile_id, name)
);

-- Entity Instances
CREATE TABLE entity_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES entity_templates(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  identifier VARCHAR(255) NOT NULL,
  description TEXT,
  data JSONB NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT entity_instances_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT entity_instances_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT entity_instances_template_id_fkey FOREIGN KEY (template_id) REFERENCES entity_templates(id) ON DELETE CASCADE,
  CONSTRAINT unique_identifier_per_profile UNIQUE (profile_id, identifier)
);

-- Entity Media Files
CREATE TABLE entity_media_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_instance_id UUID NOT NULL REFERENCES entity_instances(id) ON DELETE CASCADE,
  field_id VARCHAR(255) NOT NULL,
  blob_url VARCHAR(500) NOT NULL,
  blob_container VARCHAR(100) NOT NULL DEFAULT 'entity-media',
  blob_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(50) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size BIGINT,
  width INTEGER,
  height INTEGER,
  duration INTEGER,
  alt_text TEXT,
  caption TEXT,
  order_index INTEGER DEFAULT 0,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT entity_media_files_entity_instance_id_fkey FOREIGN KEY (entity_instance_id) REFERENCES entity_instances(id) ON DELETE CASCADE
);

-- Indexes for entity tables
CREATE INDEX idx_entity_templates_user_profile ON entity_templates(user_id, profile_id);
CREATE INDEX idx_entity_instances_user_profile ON entity_instances(user_id, profile_id);
CREATE INDEX idx_entity_instances_identifier ON entity_instances(profile_id, identifier) WHERE is_active = TRUE;
CREATE INDEX idx_entity_media_files_entity_id ON entity_media_files(entity_instance_id);
```

**Conversations Table** (See `CRITICAL_ANALYSIS_AGENT.md` Section 3.1):
```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT conversations_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL, -- 'user' or 'assistant'
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT conversation_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE INDEX idx_conversation_messages_conversation_id ON conversation_messages(conversation_id);
CREATE INDEX idx_conversations_profile_id ON conversations(profile_id);
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
```

**Profile Backups Table**:
```sql
CREATE TABLE profile_backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  backup_url VARCHAR(500) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT profile_backups_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT profile_backups_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_profile_backups_profile_id ON profile_backups(profile_id);
CREATE INDEX idx_profile_backups_user_id ON profile_backups(user_id);
```

### 4.2 Prisma Schema and Migrations

**Prisma Schema File**: `prisma/schema.prisma`
- Defines all database models, relationships, and indexes
- Type-safe with automatic TypeScript type generation
- Single source of truth for database schema

**Migration Commands**:
```bash
# Generate Prisma Client (after schema changes)
npm run db:generate

# Create and apply migration (development)
npm run db:migrate

# Apply migrations (production)
npm run db:migrate:deploy

# Push schema changes without migration (development only)
npm run db:push

# Open Prisma Studio (database GUI)
npm run db:studio
```

**Data Migration Script**:
```typescript
// scripts/migrate-profiles.ts
// See ARCHITECTURE_MIGRATION_PLAN.md Section 3.1
// Migrates existing file system profiles to database using Prisma Client
```

---

## Part 5: Backend Code Changes

### 5.1 Database Connection Module (Prisma)

**File**: `lib/db.ts`

**Changes Required**:
- Use Prisma Client for type-safe database access
- Connection pooling handled automatically by Prisma
- Transaction support via Prisma's `$transaction`
- Query logging configured in Prisma Client

**Implementation** (Prisma 7 with adapter):
```typescript
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

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set');
  }

  // Prisma 7 requires explicit adapter for connection pooling
  const pool = new Pool({
    connectionString: url,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  const client = new PrismaClient({
    adapter: new PrismaPg(pool),
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = client;
  }

  return client;
}

export const db = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return (getPrismaClient() as any)[prop];
  },
});

// Transaction support
export async function transaction<T>(
  callback: (tx: PrismaClient) => Promise<T>
): Promise<T> {
  return await db.$transaction(callback);
}

// Close database connection
export async function closeDb(): Promise<void> {
  await db.$disconnect();
}
```

**Prisma Schema**: `prisma/schema.prisma`
- Defines all database models with relationships
- Type-safe queries with auto-generated TypeScript types
- Migrations managed by Prisma Migrate

### 5.2 Authentication Module

**File**: `app/api/auth/[...nextauth]/route.ts`

**Changes Required**:
- Implement NextAuth.js with Azure AD B2C provider
- Use JWT strategy for stateless sessions
- Store user ID in session token
- Add session refresh logic

**Implementation** (See `ARCHITECTURE_MIGRATION_PLAN.md` Section 1):
```typescript
import NextAuth from 'next-auth';
import AzureADB2CProvider from 'next-auth/providers/azure-ad-b2c';
import { getSecret } from '@/lib/secrets';

export const authOptions = {
  providers: [
    AzureADB2CProvider({
      tenantId: await getSecret('AZURE_AD_B2C_TENANT_ID'),
      clientId: await getSecret('AZURE_AD_B2C_CLIENT_ID'),
      clientSecret: await getSecret('AZURE_AD_B2C_CLIENT_SECRET'),
      primaryUserFlow: await getSecret('AZURE_AD_B2C_SIGNUP_SIGNIN_POLICY'),
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account) {
        token.accessToken = account.access_token;
        token.userId = profile?.oid; // Azure AD user ID
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.userId = token.userId;
      return session;
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
  secret: await getSecret('NEXTAUTH_SECRET'),
};

export default NextAuth(authOptions);
```

### 5.3 Middleware for Route Protection

**File**: `middleware.ts`

**Changes Required**:
- Add authentication check for protected routes
- Extract user ID from session
- Add to request headers for API routes

**Implementation**:
```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
  const token = await getToken({ 
    req: request, 
    secret: process.env.NEXTAUTH_SECRET 
  });
  
  // Protect API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Add user ID to request headers
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', token.userId as string);
    
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*', '/avatar/:path*'],
};
```

### 5.4 Secrets Management Module

**File**: `lib/secrets.ts` (NEW)

**Purpose**: Centralized secret retrieval with Key Vault support

**Implementation**: See Part 3.2 above

### 5.5 Rate Limiting Module

**File**: `lib/rate-limit.ts` (NEW)

**Purpose**: Rate limiting for API routes using Upstash Redis

**Required Dependencies**:
- `@upstash/ratelimit`
- `@upstash/redis`

**Implementation**:
```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

// Different rate limits for different endpoints
const agentRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, '1 m'), // 20 requests per minute
  analytics: true,
});

const uploadRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 m'), // 10 uploads per minute
  analytics: true,
});

export async function checkRateLimit(
  userId: string,
  endpoint: 'agent' | 'upload' | 'api' = 'api'
): Promise<{ allowed: boolean; remaining: number; reset: number }> {
  const limiter = endpoint === 'agent' 
    ? agentRatelimit 
    : endpoint === 'upload'
    ? uploadRatelimit
    : agentRatelimit; // Default to agent limits

  const { success, remaining, reset } = await limiter.limit(`rate-limit:${userId}:${endpoint}`);
  
  return {
    allowed: success,
    remaining,
    reset,
  };
}
```

**Environment Variables**:
```
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token
```

### 5.6 Error Boundary Component

**File**: `src/components/ErrorBoundary/ErrorBoundary.tsx` (NEW)

**Purpose**: Catch and handle React errors gracefully

**Implementation**:
```typescript
'use client';

import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    // Log to error tracking service (Application Insights)
    if (typeof window !== 'undefined' && (window as any).appInsights) {
      (window as any).appInsights.trackException({
        exception: error,
        properties: { errorInfo },
      });
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleReset);
      }
      
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
          <h2 className="text-2xl font-bold mb-4">Something went wrong</h2>
          <p className="text-red-500 mb-4">{this.state.error.message}</p>
          <button
            onClick={this.handleReset}
            className="px-4 py-2 bg-[var(--accent-primary)] text-white rounded-lg"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

**Usage**:
```typescript
// In app/layout.tsx or app/avatar/page.tsx
<ErrorBoundary fallback={(error, reset) => <ErrorFallback error={error} onReset={reset} />}>
  <AvatarPage />
</ErrorBoundary>
```

### 5.7 Reconnection Manager

**File**: `lib/reconnection-manager.ts` (NEW)

**Purpose**: Manage avatar session reconnections with exponential backoff

**Implementation**:
```typescript
export class ReconnectionManager {
  private reconnectAttempts = 0;
  private maxAttempts = 5;
  private baseDelay = 1000;
  private isReconnecting = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private onReconnect: (() => Promise<void>) | null = null;
  private onFailure: ((error: Error) => void) | null = null;

  constructor(config?: {
    maxAttempts?: number;
    baseDelay?: number;
  }) {
    if (config?.maxAttempts) this.maxAttempts = config.maxAttempts;
    if (config?.baseDelay) this.baseDelay = config.baseDelay;
  }

  async attemptReconnect(
    onReconnect: () => Promise<void>,
    onFailure: (error: Error) => void
  ): Promise<void> {
    if (this.isReconnecting) return;
    
    this.onReconnect = onReconnect;
    this.onFailure = onFailure;

    if (this.reconnectAttempts >= this.maxAttempts) {
      onFailure(new Error('Max reconnection attempts reached'));
      return;
    }

    this.isReconnecting = true;
    const delay = this.baseDelay * Math.pow(2, this.reconnectAttempts);
    
    this.reconnectTimer = setTimeout(async () => {
      try {
        await onReconnect();
        this.reconnectAttempts = 0; // Reset on success
        this.isReconnecting = false;
      } catch (error) {
        this.reconnectAttempts++;
        this.isReconnecting = false;
        if (this.reconnectAttempts < this.maxAttempts) {
          this.attemptReconnect(onReconnect, onFailure);
        } else {
          onFailure(error as Error);
        }
      }
    }, delay);
  }

  cancel(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.isReconnecting = false;
    this.reconnectAttempts = 0;
  }

  reset(): void {
    this.cancel();
    this.reconnectAttempts = 0;
  }
}
```

**Usage in `useAvatarSession.ts`**:
```typescript
const reconnectionManagerRef = useRef(new ReconnectionManager({
  maxAttempts: 5,
  baseDelay: 1000,
}));

// In data channel handler:
if (eventData.event.eventType === 'EVENT_TYPE_SESSION_END') {
  reconnectionManagerRef.current.attemptReconnect(
    async () => {
      await startSession();
    },
    (error) => {
      setError(error.message);
      updateState('error');
    }
  );
}

// Cleanup on unmount:
useEffect(() => {
  return () => {
    reconnectionManagerRef.current.cancel();
  };
}, []);
```

### 5.8 Resource Manager

**File**: `lib/resource-manager.ts` (NEW)

**Purpose**: Track and cleanup resources (video elements, audio streams, etc.)

**Implementation**:
```typescript
interface Disposable {
  dispose: () => void;
}

export class ResourceManager {
  private resources: Set<Disposable> = new Set();

  register<T extends Disposable>(resource: T): T {
    this.resources.add(resource);
    return resource;
  }

  unregister(resource: Disposable): void {
    this.resources.delete(resource);
  }

  dispose(): void {
    this.resources.forEach(r => {
      try {
        r.dispose();
      } catch (error) {
        console.error('Error disposing resource:', error);
      }
    });
    this.resources.clear();
  }

  disposeAll(): void {
    this.dispose();
  }
}
```

**Usage**:
```typescript
const resourceManagerRef = useRef(new ResourceManager());

// Register video element
const videoElement = document.createElement('video');
resourceManagerRef.current.register({
  dispose: () => {
    videoElement.srcObject = null;
    videoElement.remove();
  }
});

// Cleanup on unmount
useEffect(() => {
  return () => {
    resourceManagerRef.current.dispose();
  };
}, []);
```

### 5.9 Google Maps API Proxy

**File**: `src/app/api/maps/route.ts` (NEW)

**Purpose**: Proxy Google Maps API requests to hide API key from client

**Implementation**:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { getSecret } from '@/lib/secrets';

export async function GET(req: NextRequest) {
  // Optional: Require authentication
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  const zoom = searchParams.get('zoom') || '14';
  const maptype = searchParams.get('maptype') || 'roadmap';

  if (!lat || !lng) {
    return NextResponse.json({ error: 'Missing lat/lng' }, { status: 400 });
  }

  const apiKey = await getSecret('GOOGLE_MAPS_API_KEY');
  const embedUrl = `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${lat},${lng}&zoom=${zoom}&maptype=${maptype}`;

  // Return URL (client will use in iframe)
  return NextResponse.json({ url: embedUrl });
}
```

**Usage in Component**:
```typescript
// CompanyInfoCards.tsx
const [mapUrl, setMapUrl] = useState<string | null>(null);

useEffect(() => {
  if (entity.coordinates) {
    fetch(`/api/maps?lat=${entity.coordinates.lat}&lng=${entity.coordinates.lng}`)
      .then(res => res.json())
      .then(data => setMapUrl(data.url))
      .catch(console.error);
  }
}, [entity.coordinates]);

// In render:
{mapUrl && (
  <iframe
    src={mapUrl}
    width="100%"
    height="100%"
    style={{ border: 0 }}
    loading="lazy"
    allowFullScreen
  />
)}
```

---

## Part 6: API Routes - Complete Refactoring

**Reference**: `ARCHITECTURE_MIGRATION_PLAN.md` Section 2.4, `CRITICAL_ANALYSIS_PRESETS_APPEARANCE.md` Section 1

### 6.1 Profiles API Routes

#### 6.1.1 GET `/api/profiles`

**File**: `src/app/api/profiles/route.ts`

**Current Issues** (See `CRITICAL_ANALYSIS_PRESETS_APPEARANCE.md`):
- No user context
- Uses file system (`listProfiles()`)
- No authentication

**Required Changes**:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const profiles = await db.query(
    'SELECT * FROM profiles WHERE user_id = $1 ORDER BY created_at DESC',
    [session.userId]
  );

  return NextResponse.json({ profiles: profiles.rows });
}
```

#### 6.1.2 POST `/api/profiles`

**File**: `src/app/api/profiles/route.ts`

**Required Changes**:
- Add authentication
- Create profile in database (not file system)
- Set default configs from `lib/config.ts`
- Return created profile

**Implementation**:
```typescript
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { name } = body;

  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  const profile = await db.profile.create({
    data: {
      userId: session.userId,
      name,
      avatarConfig: getDefaultAvatarConfig(),
      speechConfig: getDefaultSpeechConfig(),
      ttsConfig: getDefaultTTSConfig(),
      openaiConfig: getDefaultAzureOpenAIConfig(),
      sttConfig: { locales: ['en-US'], continuousConversation: false },
      appTitle: 'Netways Avatar',
      appDescription: 'AI-powered voice assistant',
      theme: 'light',
    },
  });

  return NextResponse.json({ profile });
}
```

#### 6.1.3 GET `/api/profiles/[id]`

**File**: `src/app/api/profiles/[id]/route.ts`

**Required Changes**:
- Add authentication
- Verify profile ownership (user_id check)
- Query from database
- Return profile with all configs

**Implementation**:
```typescript
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const profile = await db.profile.findFirst({
    where: {
      id,
      userId: session.userId,
    },
  });

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  return NextResponse.json(profile);
}
```

#### 6.1.4 PUT `/api/profiles/[id]`

**File**: `src/app/api/profiles/[id]/route.ts`

**Required Changes** (See `CRITICAL_ANALYSIS_PRESETS_APPEARANCE.md` Section 2.3):
- Add authentication
- Verify ownership
- Validate all configs before saving
- Use database transaction
- Update `updated_at` timestamp

**Implementation**:
```typescript
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  // Verify ownership
  const existing = await db.profile.findFirst({
    where: {
      id,
      userId: session.userId,
    },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  // Validate configs (see lib/config.ts for validation functions)
  const validationErrors = [];
  if (body.avatar_config) {
    const avatarError = validateAvatarConfig(body.avatar_config);
    if (avatarError) validationErrors.push(`Avatar config: ${avatarError}`);
  }
  if (body.speech_config) {
    const speechError = validateSpeechConfig(body.speech_config);
    if (speechError) validationErrors.push(`Speech config: ${speechError}`);
  }
  if (body.openai_config) {
    const openAIError = validateAzureOpenAIConfig(body.openai_config);
    if (openAIError) validationErrors.push(`OpenAI config: ${openAIError}`);
  }

  if (validationErrors.length > 0) {
    return NextResponse.json(
      { error: 'Validation failed', details: validationErrors },
      { status: 400 }
    );
  }

  // Update profile (Prisma handles JSON automatically)
  const profile = await db.profile.update({
    where: {
      id,
      userId: session.userId,
    },
    data: {
      name: body.name,
      avatarConfig: body.avatar_config,
      speechConfig: body.speech_config,
      ttsConfig: body.tts_config,
      openaiConfig: body.openai_config,
      sttConfig: body.stt_config,
      appTitle: body.app_title,
      appDescription: body.app_description,
      theme: body.theme,
      accentColor: body.accent_color,
      logoBlobUrl: body.logo_blob_url,
      backgroundBlobUrl: body.background_blob_url,
    },
  });

  return NextResponse.json({ profile });
}
```

#### 6.1.5 DELETE `/api/profiles/[id]`

**File**: `src/app/api/profiles/[id]/route.ts`

**Required Changes**:
- Add authentication
- Verify ownership
- Delete from database (CASCADE will handle related records)
- Delete assets from Blob Storage

**Implementation**:
```typescript
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  // Verify ownership and get asset URLs
  const profile = await db.profile.findFirst({
    where: {
      id,
      userId: session.userId,
    },
    select: {
      logoBlobUrl: true,
      backgroundBlobUrl: true,
    },
  });

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  // Delete assets from Blob Storage
  const { deleteAsset } = await import('@/lib/blob-storage');
  if (profile.logoBlobUrl) {
    await deleteAsset(profile.logoBlobUrl).catch(console.error);
  }
  if (profile.backgroundBlobUrl) {
    await deleteAsset(profile.backgroundBlobUrl).catch(console.error);
  }

  // Delete profile (CASCADE will delete related records via Prisma)
  await db.profile.delete({
    where: {
      id,
      userId: session.userId,
    },
  });

  return NextResponse.json({ success: true });
}
```

### 6.2 Assets API Routes

#### 6.2.1 GET `/api/profiles/[id]/assets`

**File**: `src/app/api/profiles/[id]/assets/route.ts`

**Current Issues**:
- Uses file system
- No authentication
- No ownership check

**Required Changes**:
- Add authentication
- Verify ownership
- Generate SAS URL from Blob Storage
- Return blob URL with expiration

**Implementation**:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { db } from '@/lib/db';
import { getAssetUrl } from '@/lib/blob-storage';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const filename = searchParams.get('file');

  if (!filename) {
    return NextResponse.json({ error: 'File parameter required' }, { status: 400 });
  }

  // Verify ownership
  const profile = await db.profile.findFirst({
    where: {
      id,
      userId: session.userId,
    },
    select: {
      logoBlobUrl: true,
      backgroundBlobUrl: true,
    },
  });

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  // Determine asset type from filename
  const isLogo = profile.logoBlobUrl?.includes(filename);
  const isBackground = profile.backgroundBlobUrl?.includes(filename);

  if (!isLogo && !isBackground) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  const blobUrl = isLogo ? profile.logoBlobUrl : profile.backgroundBlobUrl;
  
  // Generate SAS URL with expiration
  const sasUrl = await getAssetUrl(session.userId, id, isLogo ? 'logo' : 'background');

  // Redirect to SAS URL or return it
  return NextResponse.redirect(sasUrl);
}
```

#### 6.2.2 POST `/api/profiles/[id]/assets`

**File**: `src/app/api/profiles/[id]/assets/route.ts`

**Required Changes** (See `CRITICAL_ANALYSIS_PRESETS_APPEARANCE.md` Section 3.1):
- Add authentication
- Verify ownership
- Upload to Blob Storage (not file system)
- Delete old asset if exists
- Update profile with new blob URL
- Return new asset URL

**Implementation**:
```typescript
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const formData = await req.formData();
  const file = formData.get('file') as File;
  const assetType = formData.get('assetType') as 'logo' | 'background';

  if (!file || !assetType) {
    return NextResponse.json({ error: 'File and assetType required' }, { status: 400 });
  }

  // Verify ownership
  const profile = await db.query(
    'SELECT * FROM profiles WHERE id = $1 AND user_id = $2',
    [id, session.userId]
  );

  if (profile.rows.length === 0) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  // Validate file
  const maxSize = assetType === 'logo' ? 5 * 1024 * 1024 : 50 * 1024 * 1024; // 5MB logo, 50MB background
  if (file.size > maxSize) {
    return NextResponse.json(
      { error: `File too large. Maximum size: ${maxSize / 1024 / 1024}MB` },
      { status: 400 }
    );
  }

  const allowedTypes = assetType === 'logo'
    ? ['image/png', 'image/jpeg', 'image/jpg']
    : ['image/png', 'image/jpeg', 'image/jpg', 'video/mp4', 'video/webm'];

  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json(
      { error: `Invalid file type. Allowed: ${allowedTypes.join(', ')}` },
      { status: 400 }
    );
  }

  // Use profile service layer (handles transaction guarantees)
  const { uploadProfileAsset } = await import('@/lib/profile-service');
  
  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await uploadProfileAsset(
    session.userId,
    id,
    assetType,
    buffer,
    file.name,
    file.type
  );

  return NextResponse.json({ url: result.sasUrl, filename: result.filename });
}
```

### 7.3 Knowledge Base API Routes

#### 6.3.1 GET `/api/profiles/[id]/knowledge`

**File**: `src/app/api/profiles/[id]/knowledge/route.ts`

**Required Changes**:
- Add authentication
- Verify ownership
- Query from database (not file system)
- Return list of knowledge files

**Implementation**:
```typescript
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  // Verify ownership
  const profile = await db.query(
    'SELECT * FROM profiles WHERE id = $1 AND user_id = $2',
    [id, session.userId]
  );

  if (profile.rows.length === 0) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  // Get knowledge files
  const files = await db.knowledgeFile.findMany({
    where: {
      profileId: id,
      userId: session.userId,
    },
    select: {
      id: true,
      filename: true,
      uploadedAt: true,
      azureSearchIndexed: true,
      chunkCount: true,
    },
    orderBy: {
      uploadedAt: 'desc',
    },
  });

  return NextResponse.json({ files });
}
```

#### 6.3.2 POST `/api/profiles/[id]/knowledge`

**File**: `src/app/api/profiles/[id]/knowledge/route.ts`

**Required Changes** (See `AZURE_AI_SEARCH_ARCHITECTURE.md` Section 7):
- Add authentication
- Verify ownership
- Upload file to Blob Storage
- Process document (chunking)
- Generate embeddings
- Index in Azure AI Search
- Save metadata to database

**Implementation**: See `AZURE_AI_SEARCH_ARCHITECTURE.md` Section 7.1

### 7.4 Agent API Route

#### 6.4.1 POST `/api/agent`

**File**: `src/app/api/agent/route.ts`

**Required Changes** (See `CRITICAL_ANALYSIS_AGENT.md` Section 1.1, 3.1):
- Add authentication
- Require profileId in request
- Verify profile ownership
- Build agent with user/profile context
- Load conversation history from database
- Save messages to database
- Extract entity visualization from tool calls
- Return reply with entity visualization
- Add rate limiting
- Support streaming responses (optional)

**Implementation**: See `CRITICAL_ANALYSIS_AGENT.md` Section 6.2

**Rate Limiting**:
```typescript
import { checkRateLimit } from '@/lib/rate-limit';

// In POST handler:
const rateLimit = await checkRateLimit(session.userId);
if (!rateLimit.allowed) {
  return NextResponse.json(
    { error: 'Rate limit exceeded', retryAfter: 60 },
    { 
      status: 429,
      headers: { 'Retry-After': '60' }
    }
  );
}
```

**Streaming Support** (Optional):
```typescript
// For streaming responses (better UX)
export async function POST(req: NextRequest) {
  // ... authentication and validation ...
  
  const stream = await agent.stream({ messages });
  
  return new Response(
    new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const text = chunk.content || '';
          controller.enqueue(
            new TextEncoder().encode(`data: ${JSON.stringify({ text })}\n\n`)
          );
        }
        controller.close();
      },
    }),
    {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    }
  );
}
```

### 7.5 Entity API Routes

#### 6.5.1 Entity Templates Routes

**File**: `src/app/api/profiles/[id]/entities/templates/route.ts` (NEW)

**Implementation**: See `ENTITY_VISUALIZATION_SYSTEM.md` Section 4.1

#### 6.5.2 Entity Instances Routes

**File**: `src/app/api/profiles/[id]/entities/instances/route.ts` (NEW)

**Implementation**: See `ENTITY_VISUALIZATION_SYSTEM.md` Section 4.2

#### 6.5.3 Entity Media Upload Route

**File**: `src/app/api/profiles/[id]/entities/[instanceId]/media/route.ts` (NEW)

**Implementation**: See `ENTITY_VISUALIZATION_SYSTEM.md` Section 4.3

---

## Part 8: Blob Storage Integration

**Reference**: `ARCHITECTURE_MIGRATION_PLAN.md` Section 2.3

### 8.1 Blob Storage Module

**File**: `lib/blob-storage.ts` (NEW)

**Purpose**: Centralized Blob Storage operations

**Required Functions**:
- `uploadAsset()` - Upload file to Blob Storage
- `deleteAsset()` - Delete file from Blob Storage
- `getAssetUrl()` - Generate SAS URL with expiration
- `listAssets()` - List assets in container

**Implementation**: See `ARCHITECTURE_MIGRATION_PLAN.md` Section 2.3

### 8.2 Container Structure

**Containers to Create**:
- `avatar-assets` - Profile logos and backgrounds
- `entity-media` - Entity images and videos
- `knowledge-files` - Raw knowledge base files

**Path Structure**:
- `avatar-assets/{userId}/{profileId}/{timestamp}-{filename}`
- `entity-media/{userId}/{profileId}/{instanceId}/{fieldId}/{filename}`
- `knowledge-files/{userId}/{profileId}/{timestamp}-{filename}`

### 8.3 SAS Token Generation

**File**: `lib/blob-storage.ts`

**Purpose**: Generate time-limited SAS URLs for secure asset access

**Configuration**:
- **Preferred Method**: `AZURE_STORAGE_ACCOUNT_NAME` + `AZURE_STORAGE_ACCOUNT_KEY` (better for SAS tokens, can use Key Vault)
- **Alternative Method**: `AZURE_STORAGE_CONNECTION_STRING` (extracts key automatically)

**How SAS Token Generation Works**:

The `getAssetUrl()` function extracts the account key from your connection string automatically:

1. **Connection String Format**: `DefaultEndpointsProtocol=https;AccountName=mystorageaccount;AccountKey=your-key-here;EndpointSuffix=core.windows.net`
2. **Key Extraction**: Uses regex to extract `AccountKey=([^;]+)` from the connection string
3. **SAS Token Generation**: Uses the extracted key with `StorageSharedKeyCredential` to generate the SAS token

**If you're using connection string, it automatically extracts the key for SAS token generation - no additional config needed!**

**Alternative**: You can also set `AZURE_STORAGE_ACCOUNT_KEY` separately (useful for Key Vault), but connection string is sufficient.

**Implementation**:
```typescript
import { BlobServiceClient, StorageSharedKeyCredential, generateBlobSASQueryParameters, BlobSASPermissions } from '@azure/storage-blob';

export async function getAssetUrl(
  userId: string,
  profileId: string,
  assetType: 'logo' | 'background',
  expiresInMinutes: number = 60
): Promise<string> {
  // Verify ownership
  const profile = await db.query(
    'SELECT * FROM profiles WHERE id = $1 AND user_id = $2',
    [profileId, userId]
  );

  if (profile.rows.length === 0) {
    throw new Error('Unauthorized');
  }

  const blobUrl = profile.rows[0][`${assetType}_blob_url`];
  if (!blobUrl) {
    throw new Error('Asset not found');
  }

  // Extract blob name from URL
  const blobName = extractBlobName(blobUrl);
  const containerName = 'avatar-assets';
  
  // Generate SAS token
  const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME!;
  const accountKey = await getSecret('AZURE_STORAGE_ACCOUNT_KEY');
  
  const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
  const sasToken = generateBlobSASQueryParameters(
    {
      containerName,
      blobName,
      permissions: BlobSASPermissions.parse('r'), // Read only
      startsOn: new Date(),
      expiresOn: new Date(Date.now() + expiresInMinutes * 60 * 1000),
    },
    sharedKeyCredential
  ).toString();

  const blobServiceClient = new BlobServiceClient(
    `https://${accountName}.blob.core.windows.net`,
    sharedKeyCredential
  );
  const containerClient = blobServiceClient.getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  return `${blockBlobClient.url}?${sasToken}`;
}
```

---

## Part 9: Azure AI Search Integration

**Reference**: `AZURE_AI_SEARCH_ARCHITECTURE.md`

### 9.1 Azure AI Search Client Module

**File**: `lib/azure-search.ts` (NEW)

**Purpose**: Azure AI Search client setup

**Implementation**: See `AZURE_AI_SEARCH_ARCHITECTURE.md` Section 5.1

### 9.2 Document Processing Module

**File**: `lib/document-processing.ts` (NEW)

**Purpose**: Document chunking and processing

**Implementation**: See `AZURE_AI_SEARCH_ARCHITECTURE.md` Section 4.1

### 9.3 Embeddings Module

**File**: `lib/embeddings.ts` (NEW)

**Purpose**: Generate embeddings using Azure OpenAI

**Implementation**: See `AZURE_AI_SEARCH_ARCHITECTURE.md` Section 4.2

### 9.4 Indexing Module

**File**: `lib/indexing.ts` (NEW)

**Purpose**: Index documents in Azure AI Search

**Implementation**: See `AZURE_AI_SEARCH_ARCHITECTURE.md` Section 5.2

### 9.5 Search Module

**File**: `lib/search.ts` (NEW)

**Purpose**: Vector search queries

**Implementation**: See `AZURE_AI_SEARCH_ARCHITECTURE.md` Section 5.3

### 9.6 Index Creation Script

**File**: `scripts/create-search-index.ts` (NEW)

**Purpose**: Create Azure AI Search index with proper schema

**Implementation**: See `AZURE_AI_SEARCH_ARCHITECTURE.md` Section 2.1

---

## Part 10: Entity Visualization System Backend

**Reference**: `ENTITY_VISUALIZATION_SYSTEM.md`

### 10.1 Entity Tool Implementation

**File**: `agent/tools/entity-visualization.ts` (NEW)

**Purpose**: LangChain tool for entity visualization

**Implementation**: See `ENTITY_VISUALIZATION_SYSTEM.md` Section 3.1

### 10.2 Entity Helper Functions

**File**: `lib/entity-helpers.ts` (NEW)

**Purpose**: Helper functions for entity data processing

**Functions**:
- `getNestedValue()` - Extract nested values from entity data
- `buildAgentContext()` - Format entity data for agent
- `buildVisualizationData()` - Build visualization structure

**Implementation**: See `ENTITY_VISUALIZATION_SYSTEM.md` Section 3.1

---

## Part 11: Agent System Refactoring

**Reference**: `CRITICAL_ANALYSIS_AGENT.md`

### 11.1 Agent Factory

**File**: `agent/factory.ts` (NEW)

**Purpose**: Build agent per-request with proper context

**Implementation**: See `CRITICAL_ANALYSIS_AGENT.md` Section 6.1

### 11.2 LLM Configuration Module

**File**: `agent/llm.ts`

**Current Issues**: Uses env vars, no user config

**Required Changes**:
- Accept config from profile
- Remove env var fallbacks
- Add validation
- Support per-profile LLM configs

**Implementation**: See `CRITICAL_ANALYSIS_AGENT.md` Section 1.5

### 11.3 Knowledge Base Tool

**File**: `agent/tools/knowledge.ts`

**Current Issues**: Uses file system, no user/profile context

**Required Changes**:
- Replace with Azure AI Search tool
- Add user/profile filtering
- Use vector search instead of keyword matching

**Implementation**: See `AZURE_AI_SEARCH_ARCHITECTURE.md` Section 6.1

### 11.4 System Prompt Builder

**File**: `agent/prompt-builder.ts` (NEW)

**Purpose**: Build system prompt with dynamic injection

**Functions**:
- `buildSystemPrompt()` - Main function
- `buildLanguageGuidelines()` - Extract from STT config
- `shouldAutoInjectLanguageGuidelines()` - Check if needed

**Implementation**: See `CRITICAL_ANALYSIS_AGENT.md` Section 2.1

### 11.5 Agent Graph Module

**File**: `agent/graph.ts`

**Current Issues**: Built at module level, no user context

**Required Changes**:
- Remove module-level agent building
- Use AgentFactory instead
- Remove hardcoded tools
- Support configurable tools per profile

**Implementation**: See `CRITICAL_ANALYSIS_AGENT.md` Section 1.4

---

## Part 12: Frontend Code Changes

**Reference**: `CRITICAL_ANALYSIS.md`, `CRITICAL_ANALYSIS_PRESETS_APPEARANCE.md`

### 12.1 Settings Context Refactoring

**File**: `src/context/SettingsContext.tsx`

**Current Issues** (See `CRITICAL_ANALYSIS_PRESETS_APPEARANCE.md` Section 1.1):
- Multiple state variables that can desynchronize
- URL construction in multiple places
- No atomic updates
- Race conditions

**Required Changes**:
- Use state machine for profile state
- Centralize URL construction
- Add atomic state updates
- Add AbortController for cancellation
- Add dirty state tracking
- Add auto-save with debouncing

**Implementation**: See `CRITICAL_ANALYSIS_PRESETS_APPEARANCE.md` Section 1.1, 2.1

### 12.2 Avatar Session Hook

**File**: `src/hooks/useAvatarSession.ts`

**Current Issues** (See `CRITICAL_ANALYSIS.md` Section 1):
- Race conditions in state management
- DOM element lifecycle issues
- Fragile reconnection logic
- Missing error recovery

**Required Changes**:
- Implement proper state machine
- Track video/audio elements in refs
- Add cleanup on unmount
- Implement reconnection manager with exponential backoff
- Add error recovery mechanisms

**Implementation**: See `CRITICAL_ANALYSIS.md` Section 1

### 12.3 Speech Recognition Hook

**File**: `src/hooks/useSpeechRecognition.ts`

**Current Issues** (See `CRITICAL_ANALYSIS.md` Section 2):
- Permission requested every time
- Initialization race conditions
- Unreliable auto-stop logic
- Missing stream cleanup

**Required Changes**:
- Cache permission state
- Make initialization async and await it
- Use event-driven auto-stop
- Track and cleanup audio streams
- Add VAD support (see Part 12.1)

**Implementation**: See `CRITICAL_ANALYSIS.md` Section 2

### 12.4 Green Screen Hook

**File**: `src/hooks/useGreenScreen.ts`

**Current Issues** (See `CRITICAL_ANALYSIS.md` Section 3):
- No WebGL context loss handling
- Hardcoded shader parameters
- No frame rate limiting (if needed)

**Required Changes**:
- Add context loss event handlers
- Make shader parameters configurable via uniforms
- Add context restoration logic
- Check video readyState before texture upload

**Implementation**: See `CRITICAL_ANALYSIS.md` Section 3

### 12.5 Agent Hook

**File**: `src/hooks/useAgent.ts`

**Current Issues** (See `CRITICAL_ANALYSIS_AGENT.md` Section 3.1):
- Conversation history in ref (lost on refresh)
- Sends API keys from client
- Limited to 12 messages

**Required Changes**:
- Load conversation history from database
- Send conversationId instead of full history
- Remove API keys from client (use server-side only)
- Support conversation persistence
- Handle entity visualization responses

**Implementation**: See `CRITICAL_ANALYSIS_AGENT.md` Section 3.1, `ENTITY_VISUALIZATION_SYSTEM.md` Section 6.1

---

## Part 13: UI Component Updates

**Reference**: `CRITICAL_ANALYSIS_UI.md`

### 13.1 VAD Hook Implementation

**File**: `src/hooks/useVAD.ts` (NEW)

**Purpose**: Voice Activity Detection using Web Audio API

**Implementation**: See `ARCHITECTURE_MIGRATION_PLAN.md` Section 4.1

### 13.2 Accent Color System

**File**: `src/hooks/useAccentColor.ts` (NEW)

**Purpose**: Manage accent colors via CSS variables

**Implementation**: See `CRITICAL_ANALYSIS_UI.md` Section 1.1

### 13.3 Global CSS Updates

**File**: `src/app/globals.css`

**Required Changes**:
- Add CSS variables for accent colors
- Add theme CSS variables
- Replace hardcoded emerald colors

**Implementation**: See `CRITICAL_ANALYSIS_UI.md` Section 1.1, 2.1

### 13.4 Settings Panel Component

**File**: `src/components/SettingsPanel/SettingsPanel.tsx`

**Current Issues** (See `CRITICAL_ANALYSIS_UI.md`):
- Hardcoded emerald colors (37+ instances)
- No accent color picker
- Hardcoded Google Maps API key
- Inconsistent asset upload handling

**Required Changes**:
- Replace all `emerald-*` classes with CSS variables
- Add accent color picker section
- Move Google Maps API key to server-side proxy
- Unify asset upload handlers
- Add file validation
- Add progress indicators
- Add error handling

**Implementation**: See `CRITICAL_ANALYSIS_UI.md` Section 1, 8, 3.1

### 13.5 Landing Page Component

**File**: `src/app/page.tsx`

**Required Changes**:
- Replace hardcoded emerald colors
- Add authentication check
- Handle loading states properly
- Remove artificial delays
- Add AbortController for profile loading

**Implementation**: See `CRITICAL_ANALYSIS_PRESETS_APPEARANCE.md` Section 1.4, `CRITICAL_ANALYSIS_UI.md` Section 1

### 13.6 Avatar Page Component

**File**: `src/app/avatar/page.tsx`

**Required Changes**:
- Replace hardcoded emerald colors
- Fix auto-start logic with state machine
- Improve video element management
- Add error boundaries
- Handle entity visualization display

**Implementation**: See `CRITICAL_ANALYSIS.md` Section 4, `CRITICAL_ANALYSIS_UI.md` Section 1

### 13.7 Entity Visualization Components

**Files** (NEW):
- `src/components/EntityTemplateBuilder/EntityTemplateBuilder.tsx`
- `src/components/EntityInstanceEditor/EntityInstanceEditor.tsx`
- `src/components/EntityVisualization/EntityVisualization.tsx`

**Implementation**: See `ENTITY_VISUALIZATION_SYSTEM.md` Section 5

### 13.8 Company Info Cards Component

**File**: `src/components/CompanyInfoCards/CompanyInfoCards.tsx`

**Required Changes**:
- Replace hardcoded emerald colors
- Move Google Maps API key to server-side
- Add proper error handling
- Improve responsive design

**Implementation**: See `CRITICAL_ANALYSIS_UI.md` Section 1, 6.2

### 13.9 Avatar Background Component

**File**: `src/components/AvatarBackground/AvatarBackground.tsx`

**Required Changes** (See `CRITICAL_ANALYSIS_PRESETS_APPEARANCE.md` Section 3.4):
- Add error handling
- Add loading states
- Make playback rate configurable
- Add fallback for broken assets
- Improve type detection

**Implementation**: See `CRITICAL_ANALYSIS_PRESETS_APPEARANCE.md` Section 3.4

---

## Part 14: Configuration & Validation Modules

### 14.1 Config Validation Module

**File**: `lib/config.ts`

**Current Issues**: No validation functions

**Required Changes**:
- Add `validateAvatarConfig()`
- Add `validateSpeechConfig()`
- Add `validateAzureOpenAIConfig()`
- Add `validateTTSConfig()`
- Add `validateSTTConfig()`

**Implementation**: Use Zod or similar validation library

### 14.2 Asset URL Builder

**File**: `lib/asset-url-builder.ts` (NEW)

**Purpose**: Centralized URL construction and parsing

**Functions**:
- `build()` - Build asset URL from profile ID and filename
- `parse()` - Parse URL to extract profile ID and filename
- `extractFilenameFromUrl()` - Extract filename from URL

**Implementation**: See `CRITICAL_ANALYSIS_PRESETS_APPEARANCE.md` Section 1.2

---

## Part 15: Migration Scripts

### 15.1 Database Migration Script

**File**: `scripts/migrations/001_initial_schema.sql`

**Purpose**: Create all database tables

**Content**: All CREATE TABLE statements from Part 4.1

### 15.2 Profile Migration Script

**File**: `scripts/migrate-profiles.ts`

**Purpose**: Migrate existing file system profiles to database

**Implementation**: See `ARCHITECTURE_MIGRATION_PLAN.md` Section 3.1

### 15.3 Knowledge Base Migration Script

**File**: `scripts/migrate-knowledge-base.ts` (NEW)

**Purpose**: Migrate existing knowledge files to Azure AI Search

**Steps**:
1. Read all knowledge files from file system
2. Upload to Blob Storage
3. Process and chunk documents
4. Generate embeddings
5. Index in Azure AI Search
6. Save metadata to database

**Implementation**: See `AZURE_AI_SEARCH_ARCHITECTURE.md` Section 7

### 15.4 Profile Backup System

**File**: `lib/backup.ts` (NEW)

**Purpose**: Automatic profile backups before major changes

**Implementation**:
```typescript
import { db } from './db';
import { uploadAsset } from './blob-storage';

export async function backupProfile(profileId: string, userId: string): Promise<string> {
  // Get current profile
  const profile = await db.profile.findFirst({
    where: {
      id: profileId,
      userId,
    },
  });

  if (!profile) {
    throw new Error('Profile not found');
  }

  // Create backup JSON
  const backupData = {
    version: 1,
    timestamp: new Date().toISOString(),
    profile: profile.rows[0],
  };

  // Upload to Blob Storage in backups container
  const backupBuffer = Buffer.from(JSON.stringify(backupData, null, 2));
  const backupUrl = await uploadAsset(backupBuffer, {
    userId,
    profileId,
    filename: `backup-${Date.now()}.json`,
    contentType: 'application/json',
    container: 'profile-backups',
  });

  // Save backup reference to database
  await db.query(
    'INSERT INTO profile_backups (profile_id, user_id, backup_url, created_at) VALUES ($1, $2, $3, NOW())',
    [profileId, userId, backupUrl]
  );

  // Cleanup old backups (keep last 10)
  await cleanupOldBackups(profileId, userId, 10);

  return backupUrl;
}

async function cleanupOldBackups(profileId: string, userId: string, keepCount: number): Promise<void> {
  const backups = await db.query(
    'SELECT id, backup_url FROM profile_backups WHERE profile_id = $1 AND user_id = $2 ORDER BY created_at DESC',
    [profileId, userId]
  );

  if (backups.rows.length > keepCount) {
    const toDelete = backups.rows.slice(keepCount);
    for (const backup of toDelete) {
      // Delete from Blob Storage
      await deleteAsset(backup.backup_url).catch(console.error);
      // Delete from database
      await db.query('DELETE FROM profile_backups WHERE id = $1', [backup.id]);
    }
  }
}
```

**Database Schema Addition**:
```sql
CREATE TABLE profile_backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  backup_url VARCHAR(500) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT profile_backups_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT profile_backups_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_profile_backups_profile_id ON profile_backups(profile_id);
```

**Usage**:
```typescript
// Before major profile update
await backupProfile(profileId, userId);
await updateProfile(profileId, newData);
```

### 15.5 Profile Migration System

**File**: `lib/profile-migration.ts` (NEW)

**Purpose**: Handle profile schema versioning and migrations

**Implementation**:
```typescript
interface ProfileV1 {
  version?: 1;
  id: string;
  name: string;
  // ... old schema
}

interface ProfileV2 {
  version: 2;
  id: string;
  name: string;
  accent_color?: JSONB;
  // ... new schema
}

export function migrateProfile(profile: any): AvatarProfile {
  const version = profile.version || 1;
  
  if (version === 1) {
    // Migrate to v2
    return {
      ...profile,
      version: 2,
      accent_color: null, // Add default
      // ... other new fields with defaults
    };
  }
  
  if (version === 2) {
    // Already latest version
    return profile;
  }
  
  // Unknown version
  throw new Error(`Unknown profile version: ${version}`);
}

// Usage when loading profile:
const rawProfile = await db.profile.findUnique({
  where: { id },
});
if (rawProfile) {
  const migratedProfile = migrateProfile(rawProfile);
}
```

---

## Part 16: Testing & Validation

### 16.1 Unit Tests Required

**Files to Test**:
- `lib/db.ts` - Database operations
- `lib/blob-storage.ts` - Blob Storage operations
- `lib/azure-search.ts` - Search operations
- `agent/tools/*.ts` - All agent tools
- `lib/config.ts` - Validation functions

### 16.2 Integration Tests Required

**Scenarios**:
- Profile CRUD operations with authentication
- Asset upload and retrieval
- Knowledge base upload and search
- Entity creation and visualization
- Agent conversation flow
- Authentication flow

### 16.3 End-to-End Tests Required

**User Flows**:
1. User signs in → Creates profile → Configures settings → Starts avatar session
2. User uploads knowledge file → Agent searches knowledge base
3. User creates entity template → Creates entity instance → Agent displays entity
4. User changes accent color → UI updates dynamically

---

## Part 17: Deployment Configuration

### 17.1 Azure App Service Configuration

**Settings to Configure**:
- Environment variables (see Part 3.1)
- Always On (production)
- HTTPS Only
- Managed Identity
- Application Insights integration
- CORS settings

### 17.2 Database Configuration

**Settings**:
- Connection pooling
- Backup schedule
- Firewall rules
- SSL/TLS enforcement

### 17.3 Blob Storage Configuration

**Settings**:
- CORS rules
- Lifecycle policies
- Access tier
- Container access levels

### 17.4 Azure AI Search Configuration

**Settings**:
- Index creation
- API key rotation
- CORS (if needed)
- Scaling configuration

---

## Part 18: Monitoring & Logging

### 18.1 Application Insights Integration

**Metrics to Track**:
- API request latency
- Database query performance
- Blob Storage operations
- Azure AI Search query performance
- Agent response times
- Error rates

### 18.2 Logging Strategy

**Log Levels**:
- ERROR: Failures, exceptions
- WARN: Recoverable issues
- INFO: Important operations (profile creation, file uploads)
- DEBUG: Detailed flow (development only)

**Log Destinations**:
- Application Insights
- Azure Monitor
- Console (development)

---

## Summary Checklist

### Infrastructure
- [ ] Azure Database for PostgreSQL provisioned
- [ ] Azure Storage Account created with containers
- [ ] Azure AI Search service created
- [ ] Azure App Service created
- [ ] Azure Key Vault created (optional but recommended)
- [ ] Application Insights configured

### Database
- [ ] Prisma schema created (`prisma/schema.prisma`)
- [ ] Prisma Client generated (`npm run db:generate`)
- [ ] Database migration applied (`npm run db:migrate`)
- [ ] All tables created (users, profiles, knowledge_files, entity_*, conversations, profile_backups)
- [ ] Indexes and foreign keys verified
- [ ] Profile migration system tested

### Backend
- [ ] Database connection module implemented
- [ ] Authentication module implemented
- [ ] Middleware for route protection
- [ ] Secrets management module
- [ ] Rate limiting module implemented
- [ ] Reconnection manager implemented
- [ ] Resource manager implemented
- [ ] Error boundary component created
- [ ] Google Maps API proxy implemented
- [ ] Profile service layer implemented (`lib/profile-service.ts`)
- [ ] All API routes refactored with authentication and profile service layer
- [ ] Blob Storage integration complete (with SAS tokens)
- [ ] Azure AI Search integration complete
- [ ] Entity visualization system backend complete
- [ ] Agent system refactored
- [ ] Profile backup system implemented
- [ ] Profile migration system implemented

### Frontend
- [ ] Settings Context refactored
- [ ] All hooks updated (avatar, speech, agent, VAD)
- [ ] Accent color system implemented
- [ ] All components updated (Settings Panel, Landing Page, Avatar Page)
- [ ] Entity visualization components created
- [ ] CSS variables implemented

### Testing
- [ ] Unit tests written
- [ ] Integration tests written
- [ ] End-to-end tests written
- [ ] Migration scripts tested

### Deployment
- [ ] Environment variables configured
- [ ] Secrets stored in Key Vault
- [ ] Upstash Redis configured (for rate limiting)
- [ ] Monitoring configured
- [ ] Error tracking configured
- [ ] Documentation updated

### Additional Infrastructure
- [ ] Upstash Redis database created
- [ ] Profile backups container created in Blob Storage

