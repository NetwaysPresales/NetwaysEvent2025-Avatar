# Critical Architecture Migration Plan: Multi-User, Stateless, Database-Driven

## Executive Summary

This document provides a **hyper-critical analysis** of migrating the current single-user, file-system-based avatar application to a **multi-user, stateless, cloud-native architecture** with database storage, Azure Blob Storage, Azure AI Search (vector database), and Voice Activity Detection (VAD). 

**Critical Assessment**: The current architecture is **fundamentally incompatible** with multi-user, stateless deployment. This is not a simple migration—it requires a **complete architectural redesign**.

**Related Documents**:
- `AZURE_AI_SEARCH_ARCHITECTURE.md` - Complete vector search implementation for knowledge base
- `ENTITY_VISUALIZATION_SYSTEM.md` - Customizable entity visualization system
- `CRITICAL_ANALYSIS_AGENT.md` - LangChain agent implementation analysis
- `CRITICAL_ANALYSIS_UI.md` - UI implementation analysis

---

## 1. Authentication Architecture

### Current State Analysis
**Problem**: No authentication exists. The app assumes a single user with local file system access.

**Critical Issues**:
- All API routes are unauthenticated
- No user context in any operations
- `localStorage` used for "lastProfileId" - breaks multi-user
- No session management
- No authorization checks

### Proposed Authentication Strategy

#### Option 1: Azure AD B2C (Recommended for Enterprise)
**Pros**:
- Managed identity provider
- Enterprise SSO support
- Built-in MFA
- Scales automatically
- Integrates with Azure ecosystem

**Cons**:
- More complex setup
- Potential overkill for simple use cases
- Cost (though free tier exists)

**Implementation**:
```typescript
// Using @azure/msal-browser
import { PublicClientApplication } from '@azure/msal-browser';

const msalConfig = {
  auth: {
    clientId: process.env.NEXT_PUBLIC_AZURE_AD_B2C_CLIENT_ID!,
    authority: `https://${process.env.NEXT_PUBLIC_AZURE_AD_B2C_TENANT}.b2clogin.com/${process.env.NEXT_PUBLIC_AZURE_AD_B2C_TENANT}.onmicrosoft.com/${process.env.NEXT_PUBLIC_AZURE_AD_B2C_SIGNUP_SIGNIN_POLICY}`,
    knownAuthorities: [`${process.env.NEXT_PUBLIC_AZURE_AD_B2C_TENANT}.b2clogin.com`],
  },
  cache: {
    cacheLocation: 'sessionStorage', // Stateless - use sessionStorage
    storeAuthStateInCookie: false,
  },
};

const msalInstance = new PublicClientApplication(msalConfig);
```

**Critical Considerations**:
- **Session Storage vs LocalStorage**: For stateless apps, use `sessionStorage` or server-side sessions
- **Token Refresh**: Must handle token expiration gracefully
- **Silent Authentication**: Need to refresh tokens without user interaction

#### Option 2: NextAuth.js (Simpler, but less enterprise-ready)
**Pros**:
- Simpler setup
- Multiple provider support
- Good Next.js integration
- Built-in session management

**Cons**:
- Requires database for sessions (unless using JWT)
- Less enterprise features
- You manage user storage

**Implementation**:
```typescript
// app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth';
import AzureADProvider from 'next-auth/providers/azure-ad';

export const authOptions = {
  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      tenantId: process.env.AZURE_AD_TENANT_ID!,
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
  // Use JWT for stateless sessions
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
};

export default NextAuth(authOptions);
```

### Critical Authentication Requirements

#### 1.1 Stateless Session Management
**Problem**: Current code uses `localStorage` which is client-side only and not secure.

**Solution**: Use JWT tokens stored in httpOnly cookies or sessionStorage.

```typescript
// Middleware to protect routes
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth-token')?.value;
  
  if (!token && request.nextUrl.pathname.startsWith('/api/profiles')) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  // Verify token and extract user ID
  try {
    const payload = verifyJWT(token);
    // Add user ID to request headers for API routes
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', payload.userId);
    
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Invalid token' },
      { status: 401 }
    );
  }
}

export const config = {
  matcher: ['/api/profiles/:path*', '/avatar/:path*'],
};
```

#### 1.2 User Context in All Operations
**Critical**: Every database operation must be scoped to the authenticated user.

**Current Problem** (`profiles.ts:22-38`):
```typescript
export async function listProfiles(): Promise<AvatarProfile[]> {
  // Returns ALL profiles - no user filtering!
  const dirs = await fs.readdir(PROFILES_DIR);
  // ...
}
```

**Required Change**:
```typescript
// All profile operations must include userId
export async function listProfiles(userId: string): Promise<AvatarProfile[]> {
  // Query database with WHERE userId = ?
  // NOT file system
}
```

---

## 2. Stateless Architecture for Azure Web Apps

### Current State Analysis
**Problem**: The app is **NOT stateless**. It relies on:
- File system storage (`data/profiles/`)
- In-memory state (React context)
- No session persistence

### State Machine Implications

**Question**: "Does the state machine stuff work in stateless architecture?"

**Answer**: **YES, but with critical modifications**.

#### 2.1 Client-Side State Machines (OK for Stateless)
The state machines I proposed (session state, profile state) are **client-side React state**. These work fine in stateless architecture because:
- State lives in browser memory
- Lost on page refresh (acceptable for UI state)
- Reconstructed from server data on mount

**Example**:
```typescript
// This is fine - client-side only
const [sessionState, setSessionState] = useState<SessionState>({ type: 'idle' });

// On mount, fetch from server
useEffect(() => {
  fetchUserSession().then(session => {
    if (session) {
      setSessionState({ type: 'connected', ...session });
    }
  });
}, []);
```

#### 2.2 Server-Side State (MUST be in Database)
**Critical**: Any state that needs to persist across requests MUST be in database.

**Current Problem**: Profile state is in file system - **NOT stateless**.

**Required Changes**:
1. Move all profile data to database
2. Move asset files to Azure Blob Storage
3. Remove all file system operations
4. Use database transactions for atomic operations

### Stateless Architecture Requirements

#### 2.1 No File System Dependencies
**Current Code** (`profiles.ts`):
```typescript
const PROFILES_DIR = path.join(process.cwd(), 'data', 'profiles');
// ❌ This breaks in Azure Web Apps (read-only file system in some tiers)
```

**Solution**: Remove ALL file system operations.

#### 2.2 Database for All Persistent Data
**Required Schema** (PostgreSQL or Azure SQL):
```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  azure_ad_id VARCHAR(255) UNIQUE -- For Azure AD integration
);

-- Profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Configurations (stored as JSONB for flexibility)
  avatar_config JSONB NOT NULL,
  speech_config JSONB NOT NULL,
  tts_config JSONB NOT NULL,
  openai_config JSONB NOT NULL,
  stt_config JSONB NOT NULL,
  
  -- Appearance
  app_title VARCHAR(255),
  app_description TEXT,
  theme VARCHAR(20) DEFAULT 'light',
  accent_color JSONB, -- Per-preset accent color configuration (see CRITICAL_ANALYSIS_UI.md)
  
  -- Asset references (point to Blob Storage)
  logo_blob_url VARCHAR(500),
  background_blob_url VARCHAR(500),
  
  -- Indexes
  CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_profiles_user_id ON profiles(user_id);

-- Knowledge base files (with Azure AI Search integration)
-- See AZURE_AI_SEARCH_ARCHITECTURE.md for full vector search implementation
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
  uploaded_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT knowledge_files_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id),
  CONSTRAINT knowledge_files_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_knowledge_files_user_profile ON knowledge_files(user_id, profile_id);
CREATE INDEX idx_knowledge_files_indexed ON knowledge_files(azure_search_indexed) WHERE azure_search_indexed = FALSE;

-- Entity visualization system
-- See ENTITY_VISUALIZATION_SYSTEM.md for complete implementation
CREATE TABLE entity_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  structure JSONB NOT NULL, -- Visualization structure definition
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT entity_templates_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT entity_templates_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT unique_template_name_per_profile UNIQUE (profile_id, name)
);

CREATE TABLE entity_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES entity_templates(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  identifier VARCHAR(255) NOT NULL, -- For agent lookup
  description TEXT,
  data JSONB NOT NULL, -- Entity data matching template structure
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT entity_instances_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT entity_instances_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT entity_instances_template_id_fkey FOREIGN KEY (template_id) REFERENCES entity_templates(id) ON DELETE CASCADE,
  CONSTRAINT unique_identifier_per_profile UNIQUE (profile_id, identifier)
);

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

CREATE INDEX idx_entity_templates_user_profile ON entity_templates(user_id, profile_id);
CREATE INDEX idx_entity_templates_profile_id ON entity_templates(profile_id);
CREATE INDEX idx_entity_instances_user_profile ON entity_instances(user_id, profile_id);
CREATE INDEX idx_entity_instances_profile_id ON entity_instances(profile_id);
CREATE INDEX idx_entity_instances_template_id ON entity_instances(template_id);
CREATE INDEX idx_entity_instances_identifier ON entity_instances(profile_id, identifier) WHERE is_active = TRUE;
CREATE INDEX idx_entity_media_files_entity_id ON entity_media_files(entity_instance_id);
CREATE INDEX idx_entity_media_files_field_id ON entity_media_files(entity_instance_id, field_id);
```

#### 2.3 Azure Blob Storage for Media Files
**Implementation**:
```typescript
// lib/blob-storage.ts
import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';

const blobServiceClient = BlobServiceClient.fromConnectionString(
  process.env.AZURE_STORAGE_CONNECTION_STRING!
);

const containerClient = blobServiceClient.getContainerClient('avatar-assets');

export async function uploadAsset(
  userId: string,
  profileId: string,
  file: Buffer,
  filename: string,
  contentType: string
): Promise<string> {
  // Organize by user/profile for easy cleanup
  const blobName = `${userId}/${profileId}/${Date.now()}-${filename}`;
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  
  await blockBlobClient.upload(file, file.length, {
    blobHTTPHeaders: { blobContentType: contentType },
  });
  
  // Return SAS URL with expiration (e.g., 1 year)
  const sasUrl = await blockBlobClient.generateSasUrl({
    permissions: 'r', // Read only
    expiresOn: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
  });
  
  return sasUrl;
}

export async function deleteAsset(blobUrl: string): Promise<void> {
  // Extract blob name from URL
  const url = new URL(blobUrl);
  const blobName = url.pathname.split('/').slice(-3).join('/'); // user/profile/filename
  
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  await blockBlobClient.delete();
}
```

#### 2.4 API Route Refactoring
**Current** (`api/profiles/route.ts`):
```typescript
export async function GET() {
  const profiles = await listProfiles(); // ❌ No user context
  return NextResponse.json({ profiles });
}
```

**Required**:
```typescript
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';

export async function GET(req: NextRequest) {
  // Get authenticated user
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Query database with user filter
  const profiles = await db.query(
    'SELECT * FROM profiles WHERE user_id = $1 ORDER BY created_at',
    [session.userId]
  );
  
  return NextResponse.json({ profiles: profiles.rows });
}
```

---

## 3. Database Migration Strategy

### Critical Migration Challenges

#### 3.1 Data Migration from File System
**Problem**: Existing profiles in `data/profiles/` need to be migrated.

**Strategy**:
1. **Create migration script** that:
   - Reads all existing profiles from file system
   - Creates a "system" user or assigns to admin
   - Uploads assets to Blob Storage
   - Inserts into database

```typescript
// scripts/migrate-profiles.ts
import fs from 'fs/promises';
import path from 'path';
import { db } from '@/lib/db';
import { uploadAsset } from '@/lib/blob-storage';

async function migrateProfiles() {
  const profilesDir = path.join(process.cwd(), 'data', 'profiles');
  const dirs = await fs.readdir(profilesDir);
  
  // Create or get system user
  const systemUser = await db.query(
    'INSERT INTO users (email, name) VALUES ($1, $2) ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email RETURNING id',
    ['system@migration.local', 'System Migration User']
  );
  const userId = systemUser.rows[0].id;
  
  for (const dir of dirs) {
    const configPath = path.join(profilesDir, dir, 'config.json');
    const profile = JSON.parse(await fs.readFile(configPath, 'utf-8'));
    
    // Upload assets
    let logoBlobUrl = null;
    if (profile.logo) {
      const logoPath = path.join(profilesDir, dir, 'assets', profile.logo);
      const logoBuffer = await fs.readFile(logoPath);
      logoBlobUrl = await uploadAsset(userId, dir, logoBuffer, profile.logo, 'image/png');
    }
    
    let backgroundBlobUrl = null;
    if (profile.background) {
      const bgPath = path.join(profilesDir, dir, 'assets', profile.background);
      const bgBuffer = await fs.readFile(bgPath);
      backgroundBlobUrl = await uploadAsset(userId, dir, bgBuffer, profile.background, 'image/jpeg');
    }
    
    // Insert into database
    await db.query(
      `INSERT INTO profiles (
        id, user_id, name, created_at, updated_at,
        avatar_config, speech_config, tts_config, openai_config, stt_config,
        app_title, app_description, theme, accent_color, logo_blob_url, background_blob_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
      [
        profile.id,
        userId,
        profile.name,
        new Date(profile.created),
        new Date(profile.updated),
        JSON.stringify(profile.avatarConfig),
        JSON.stringify(profile.speechConfig),
      JSON.stringify(profile.ttsConfig),
      JSON.stringify(profile.openAIConfig),
      JSON.stringify({ locales: ['en-US'], continuousConversation: false }), // Default STT
      profile.appTitle,
      profile.appDescription,
      profile.theme,
      profile.accentColor ? JSON.stringify(profile.accentColor) : null, // Accent color from profile
      logoBlobUrl,
      backgroundBlobUrl,
      ]
    );
  }
}
```

#### 3.2 Database Connection Management
**Critical**: For stateless Azure Web Apps, use connection pooling.

```typescript
// lib/db.ts
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export const db = {
  query: (text: string, params?: any[]) => pool.query(text, params),
};
```

---

## 4. Voice Activity Detection (VAD) Implementation

### Current State Analysis
**Problem**: Currently only supports push-to-talk. No VAD option.

**Azure Speech SDK VAD Support**:
Azure Speech SDK **does NOT have built-in VAD**. However, you can implement it using:
1. **Client-side VAD** (using Web Audio API)
2. **Server-side VAD** (Azure Speech Service has silence detection, but not true VAD)
3. **Hybrid approach** (recommended)

### VAD Implementation Strategy

#### 4.1 Client-Side VAD (Recommended)
**Why**: Lower latency, works with existing push-to-talk, configurable.

**Implementation**:
```typescript
// hooks/useVAD.ts
import { useRef, useEffect, useState } from 'react';

interface VADConfig {
  enabled: boolean;
  threshold: number; // 0-1, sensitivity
  silenceTimeout: number; // ms - how long to wait before stopping
  minSpeechDuration: number; // ms - minimum speech to trigger
}

export function useVAD(config: VADConfig) {
  const [isSpeechDetected, setIsSpeechDetected] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const speechStartTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!config.enabled) return;

    let animationFrameId: number;

    const setupVAD = async () => {
      // Get microphone stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Create audio context
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      // Create analyser
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Analyze audio
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const checkAudio = () => {
        if (!analyserRef.current) return;

        analyserRef.current.getByteFrequencyData(dataArray);

        // Calculate average volume
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        const normalized = average / 255;

        // Detect speech
        if (normalized > config.threshold) {
          // Speech detected
          if (speechStartTimeRef.current === null) {
            speechStartTimeRef.current = Date.now();
          }

          // Check if speech duration is long enough
          const speechDuration = Date.now() - speechStartTimeRef.current;
          if (speechDuration >= config.minSpeechDuration) {
            setIsSpeechDetected(true);
            
            // Clear silence timer
            if (silenceTimerRef.current) {
              clearTimeout(silenceTimerRef.current);
              silenceTimerRef.current = null;
            }
          }
        } else {
          // Silence detected
          if (isSpeechDetected) {
            // Start silence timer
            if (!silenceTimerRef.current) {
              silenceTimerRef.current = setTimeout(() => {
                setIsSpeechDetected(false);
                speechStartTimeRef.current = null;
              }, config.silenceTimeout);
            }
          } else {
            speechStartTimeRef.current = null;
          }
        }

        animationFrameId = requestAnimationFrame(checkAudio);
      };

      checkAudio();
    };

    setupVAD();

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
    };
  }, [config.enabled, config.threshold, config.silenceTimeout, config.minSpeechDuration, isSpeechDetected]);

  return { isSpeechDetected };
}
```

#### 4.2 Integration with Speech Recognition
**Update STTConfig**:
```typescript
// types/avatar.ts
export interface STTConfig {
  locales: string[];
  continuousConversation: boolean;
  
  // VAD Configuration
  vad?: {
    enabled: boolean;
    mode: 'push-to-talk' | 'voice-activity-detection';
    threshold: number; // 0-1
    silenceTimeout: number; // ms
    minSpeechDuration: number; // ms
  };
  
  // ... existing options
}
```

**Update useSpeechRecognition**:
```typescript
// hooks/useSpeechRecognition.ts
import { useVAD } from './useVAD';

export function useSpeechRecognition({
  speechConfig,
  sttConfig,
  onRecognized,
  onRecognizing
}: UseSpeechRecognitionProps) {
  // ... existing code ...
  
  // VAD integration
  const { isSpeechDetected } = useVAD({
    enabled: sttConfig.vad?.enabled && sttConfig.vad?.mode === 'voice-activity-detection',
    threshold: sttConfig.vad?.threshold ?? 0.5,
    silenceTimeout: sttConfig.vad?.silenceTimeout ?? 2000,
    minSpeechDuration: sttConfig.vad?.minSpeechDuration ?? 300,
  });

  // Auto-start/stop based on VAD
  useEffect(() => {
    if (!sttConfig.vad?.enabled || sttConfig.vad.mode !== 'voice-activity-detection') {
      return;
    }

    if (isSpeechDetected && !isListening) {
      startListening();
    } else if (!isSpeechDetected && isListening) {
      stopListening();
    }
  }, [isSpeechDetected, isListening, sttConfig.vad]);
  
  // ... rest of code
}
```

#### 4.3 UI Configuration
**Add to Settings Panel**:
```typescript
// components/SettingsPanel/SettingsPanel.tsx
<div>
  <h3>Voice Input Mode</h3>
  <select
    value={sttConfig.vad?.mode || 'push-to-talk'}
    onChange={(e) => setSTTConfig({
      ...sttConfig,
      vad: {
        ...sttConfig.vad,
        enabled: true,
        mode: e.target.value as 'push-to-talk' | 'voice-activity-detection',
      }
    })}
  >
    <option value="push-to-talk">Push to Talk</option>
    <option value="voice-activity-detection">Voice Activity Detection</option>
  </select>
  
  {sttConfig.vad?.mode === 'voice-activity-detection' && (
    <>
      <label>Sensitivity (Threshold)</label>
      <input
        type="range"
        min="0"
        max="1"
        step="0.1"
        value={sttConfig.vad?.threshold ?? 0.5}
        onChange={(e) => setSTTConfig({
          ...sttConfig,
          vad: { ...sttConfig.vad, threshold: parseFloat(e.target.value) }
        })}
      />
      
      <label>Silence Timeout (ms)</label>
      <input
        type="number"
        value={sttConfig.vad?.silenceTimeout ?? 2000}
        onChange={(e) => setSTTConfig({
          ...sttConfig,
          vad: { ...sttConfig.vad, silenceTimeout: parseInt(e.target.value) }
        })}
      />
      
      <label>Min Speech Duration (ms)</label>
      <input
        type="number"
        value={sttConfig.vad?.minSpeechDuration ?? 300}
        onChange={(e) => setSTTConfig({
          ...sttConfig,
          vad: { ...sttConfig.vad, minSpeechDuration: parseInt(e.target.value) }
        })}
      />
    </>
  )}
</div>
```

---

## 5. Critical Architecture Concerns

### 5.1 State Machine in Stateless Architecture

**Question**: "Does the state machine stuff work in that case?"

**Answer**: **YES, with important caveats**:

1. **Client-Side State Machines**: ✅ Work perfectly
   - Session state (connecting, connected, etc.)
   - UI state (loading, error, etc.)
   - These are ephemeral and reconstructed on mount

2. **Server-Side State**: ❌ Must be in database
   - Profile data
   - User preferences
   - Session tokens

3. **Hybrid Approach** (Recommended):
```typescript
// Client-side state machine (UI state)
const [sessionState, setSessionState] = useState<SessionState>({ type: 'idle' });

// On mount, hydrate from server
useEffect(() => {
  fetchUserSession().then(session => {
    if (session) {
      setSessionState({ type: 'connected', ...session });
    }
  });
}, []);

// On state change, optionally sync to server (for analytics, recovery)
useEffect(() => {
  if (sessionState.type === 'connected') {
    // Optional: Log session start to database
    fetch('/api/sessions', {
      method: 'POST',
      body: JSON.stringify({ state: sessionState.type }),
    });
  }
}, [sessionState]);
```

### 5.2 Security Concerns

#### 5.2.1 API Key Storage
**Critical Problem**: Currently API keys are stored in profiles. For multi-user:
- **Option 1**: Each user provides their own keys (most flexible, but complex)
- **Option 2**: Shared keys per organization (simpler, but less flexible)
- **Option 3**: Server-side key management (most secure, but requires backend)

**Recommended**: Hybrid approach
```typescript
// Database schema addition
ALTER TABLE profiles ADD COLUMN use_shared_keys BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN speech_api_key_encrypted TEXT; -- Encrypted with user's key
ALTER TABLE profiles ADD COLUMN openai_api_key_encrypted TEXT;

// Encryption key derived from user password or stored in Azure Key Vault
```

#### 5.2.2 Blob Storage Security
**Critical**: Use SAS tokens with expiration, not public URLs.

```typescript
// Generate time-limited SAS URLs
export async function getAssetUrl(
  userId: string,
  profileId: string,
  assetType: 'logo' | 'background'
): Promise<string> {
  // Check authorization
  const profile = await db.query(
    'SELECT * FROM profiles WHERE id = $1 AND user_id = $2',
    [profileId, userId]
  );
  
  if (profile.rows.length === 0) {
    throw new Error('Unauthorized');
  }
  
  const blobUrl = profile.rows[0][`${assetType}_blob_url`];
  if (!blobUrl) return null;
  
  // Generate new SAS token (short-lived, e.g., 1 hour)
  const blobName = extractBlobName(blobUrl);
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  
  return await blockBlobClient.generateSasUrl({
    permissions: 'r',
    expiresOn: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
  });
}
```

### 5.3 Scalability Concerns

#### 5.3.1 Database Connection Pooling
**Critical**: Azure Web Apps can scale horizontally. Each instance needs its own connection pool.

```typescript
// Use environment variable for connection string
// Azure automatically handles connection pooling in App Service
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10, // Per instance
  // Azure App Service handles load balancing
});
```

#### 5.3.2 Blob Storage CDN
**Recommendation**: Use Azure CDN in front of Blob Storage for better performance.

```typescript
// Use CDN URL instead of direct blob URL
const CDN_BASE_URL = process.env.AZURE_CDN_URL || 'https://yourcdn.azureedge.net';

export function getAssetCDNUrl(blobUrl: string): string {
  // Convert blob URL to CDN URL
  const blobName = extractBlobName(blobUrl);
  return `${CDN_BASE_URL}/${blobName}`;
}
```

### 5.4 Migration Path

#### Phase 1: Database Setup (Week 1)
1. Set up PostgreSQL/Azure SQL database
2. Create schema
3. Set up Azure Blob Storage
4. Create migration script

#### Phase 2: Authentication (Week 2)
1. Implement NextAuth or Azure AD B2C
2. Add middleware for route protection
3. Update all API routes to require authentication
4. Test authentication flow

#### Phase 3: Data Migration (Week 3)
1. Run migration script
2. Verify data integrity
3. Test with migrated data
4. **Knowledge Base Migration**: See Phase 4.5 for Azure AI Search migration

#### Phase 4: Refactor API Routes (Week 4)
1. Replace file system operations with database queries
2. Replace file uploads with Blob Storage
3. Update all API routes to use user context
4. Test all CRUD operations

#### Phase 4.5: Azure AI Search Integration (Week 4-5)
**See `AZURE_AI_SEARCH_ARCHITECTURE.md` for complete implementation details.**

1. Set up Azure AI Search service
2. Create index schema with vector search
3. Implement document processing pipeline (chunking, embeddings)
4. Update knowledge base tool to use vector search
5. Migrate existing knowledge files to Azure AI Search
6. Test semantic search functionality

#### Phase 4.6: Entity Visualization System (Week 5-6)
**See `ENTITY_VISUALIZATION_SYSTEM.md` for complete implementation details.**

**Week 5**:
1. Create entity_templates, entity_instances, entity_media_files tables
2. Implement entity visualization tool for agent (replaces legacy `get_company_info` tool)
3. Create API routes for template and instance management
4. Implement media upload to Blob Storage

**Week 6**:
5. Build UI components (template builder, instance editor, visualization display)
6. Integrate with agent response handling (update to use `show_entity` tool name)
7. Test end-to-end entity visualization flow

#### Phase 5: VAD Implementation (Week 5)
1. Implement useVAD hook
2. Update STTConfig type
3. Integrate with speech recognition
4. Add UI controls
5. Test VAD functionality

#### Phase 6: Deployment (Week 6)
1. Set up Azure Web App
2. Configure environment variables
3. Set up CI/CD pipeline
4. Deploy and test
5. Monitor and fix issues

---

## 6. Critical Gotchas & Warnings

### 6.1 File System is Read-Only in Some Azure Tiers
**Warning**: Azure App Service (Basic/Standard) has a read-only file system except for `/tmp`. Your current code will **break**.

**Solution**: Remove ALL file system writes. Use database + Blob Storage.

### 6.2 localStorage Breaks Multi-User
**Warning**: `localStorage` is shared per browser, not per user. If two users use the same browser, they'll see each other's data.

**Solution**: Use sessionStorage or server-side sessions.

### 6.3 State Machines are Client-Side Only
**Warning**: The state machines I proposed are React state. They're lost on refresh. This is **intentional** for UI state, but you must hydrate from server.

**Solution**: Always fetch current state from server on mount.

### 6.4 VAD Requires Additional Microphone Stream
**Warning**: VAD needs its own microphone stream. This might conflict with Speech SDK's stream.

**Solution**: Use `AudioContext.createMediaStreamSource()` to share the stream, or use Web Audio API to split it.

### 6.5 Database Transactions are Critical
**Warning**: Profile updates must be atomic. Multiple state updates can cause corruption.

**Solution**: Use database transactions:
```typescript
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query('UPDATE profiles SET ... WHERE id = $1', [id]);
  await client.query('INSERT INTO ...');
  await client.query('COMMIT');
} catch {
  await client.query('ROLLBACK');
  throw;
} finally {
  client.release();
}
```

---

## 7. Recommended Tech Stack

### Database
- **PostgreSQL** (via Azure Database for PostgreSQL) OR
- **Azure SQL Database** (if you prefer managed SQL Server)

### Authentication
- **NextAuth.js** (simpler) OR
- **Azure AD B2C** (enterprise)

### Blob Storage
- **Azure Blob Storage** (standard tier with CDN)

### Azure AI Search
- **Azure AI Search** (Basic tier minimum, Standard recommended)
- **Azure OpenAI** (for embeddings: `text-embedding-ada-002`)
- **See `AZURE_AI_SEARCH_ARCHITECTURE.md`** for complete setup and implementation

### Deployment
- **Azure App Service** (Linux, Node.js 20)
- **Azure Application Insights** (monitoring)

### Environment Variables
```env
# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Azure Storage
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;...

# Authentication
NEXTAUTH_SECRET=your-secret
NEXTAUTH_URL=https://yourapp.azurewebsites.net

# Azure AD (if using)
AZURE_AD_CLIENT_ID=...
AZURE_AD_CLIENT_SECRET=...
AZURE_AD_TENANT_ID=...

# Azure AI Search (for knowledge base vector search)
# See AZURE_AI_SEARCH_ARCHITECTURE.md for setup details
AZURE_SEARCH_ENDPOINT=https://your-search-service.search.windows.net
AZURE_SEARCH_API_KEY=your-admin-key
AZURE_SEARCH_INDEX_NAME=knowledge-base-index

# Azure OpenAI (for embeddings)
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-ada-002
# (AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY already defined above)
```

---

## Summary

This migration is **NOT trivial**. It requires:

1. ✅ **Complete API refactoring** (all routes need user context)
2. ✅ **Database schema design** (proper normalization, indexes)
3. ✅ **Blob Storage integration** (upload, download, cleanup)
4. ✅ **Azure AI Search integration** (vector search for knowledge base)
   - See `AZURE_AI_SEARCH_ARCHITECTURE.md` for implementation
5. ✅ **Entity visualization system** (customizable entity templates and instances)
   - See `ENTITY_VISUALIZATION_SYSTEM.md` for implementation
4. ✅ **Authentication implementation** (NextAuth or Azure AD)
5. ✅ **VAD implementation** (client-side Web Audio API)
6. ✅ **State machine modifications** (client-side only, hydrate from server)
7. ✅ **Migration script** (file system → database + Blob Storage)
8. ✅ **Knowledge base vector search** (Azure AI Search with per-user/per-preset partitioning)
9. ✅ **Entity visualization system** (customizable templates, instances, media support)
8. ✅ **Security hardening** (encryption, SAS tokens, authorization)

**Estimated Effort**: 6-8 weeks for a senior developer, assuming no major blockers.

**Critical Success Factors**:
- Proper database schema design
- Comprehensive testing of authentication
- Secure handling of API keys
- Proper error handling and rollback mechanisms
- Performance optimization (connection pooling, CDN)

