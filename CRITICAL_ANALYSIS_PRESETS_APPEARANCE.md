# Critical Analysis: Presets, Avatar Settings & Session Appearance

## Executive Summary

The preset/profile system, avatar settings management, and appearance handling suffer from severe architectural flaws including: **state synchronization issues**, **inconsistent URL construction**, **missing validation**, **file handling vulnerabilities**, **race conditions**, and **poor separation of concerns**. These issues make the system fragile, hard to maintain, and prone to data loss.

---

## 1. Preset/Profile Setup (`SettingsContext.tsx`, `profiles.ts`)

### Critical Issues

#### 1.1 State Synchronization Nightmare
**Problem**: Profile state is split across multiple React state variables that can easily desynchronize.

**Current Code** (`SettingsContext.tsx:125-190`):
```typescript
const loadProfile = async (id: string) => {
    // ... fetch profile ...
    setCurrentProfile(profile);
    setSpeechConfig({ ...defaultSpeech, ...loadedSpeech, ... });
    setAvatarConfig(profile.avatarConfig || getDefaultAvatarConfig());
    setTTSConfig(profile.ttsConfig || getDefaultTTSConfig());
    setOpenAIConfig({ ...defaultOpenAI, ...loadedOpenAI, ... });
    setAppTitle(profile.appTitle || 'Netways Avatar');
    setAppDescription(profile.appDescription || '...');
    setLogoUrl(profile.logo ? `/api/profiles/${id}/assets?file=${profile.logo}` : '');
    setBackgroundUrl(profile.background ? `/api/profiles/${id}/assets?file=${profile.background}` : null);
};
```

**Issues**:
- **No atomic updates**: If any setState fails or is interrupted, state becomes inconsistent
- **Race conditions**: Multiple rapid profile switches can cause state corruption
- **No rollback mechanism**: Failed loads leave partial state
- **URL construction happens in multiple places**: Inconsistent patterns

**Alternative Approach**:
```typescript
// Use a single state machine with atomic updates
type ProfileState = 
  | { type: 'idle' }
  | { type: 'loading'; profileId: string }
  | { type: 'loaded'; profile: AvatarProfile; hydrated: HydratedProfile }
  | { type: 'error'; error: Error; previousProfile?: AvatarProfile };

interface HydratedProfile {
  speechConfig: SpeechConfig;
  avatarConfig: AvatarConfig;
  ttsConfig: TTSConfig;
  openAIConfig: AzureOpenAIConfig;
  appearance: {
    logoUrl: string | null;
    backgroundUrl: string | null;
    appTitle: string;
    appDescription: string;
  };
}

const [profileState, setProfileState] = useState<ProfileState>({ type: 'idle' });

const loadProfile = async (id: string) => {
  setProfileState({ type: 'loading', profileId: id });
  
  try {
    const profile = await fetchProfile(id);
    const hydrated = hydrateProfile(profile); // Single function that does all transformations
    
    setProfileState({ 
      type: 'loaded', 
      profile, 
      hydrated 
    });
  } catch (error) {
    setProfileState({ 
      type: 'error', 
      error: error as Error,
      previousProfile: profileState.type === 'loaded' ? profileState.profile : undefined
    });
  }
};

// Derived state for components
const speechConfig = profileState.type === 'loaded' 
  ? profileState.hydrated.speechConfig 
  : getDefaultSpeechConfig();
```

#### 1.2 Fragile URL Construction
**Problem**: Asset URLs are constructed inconsistently across the codebase.

**Current Code**:
- `SettingsContext.tsx:184`: `setLogoUrl(profile.logo ? `/api/profiles/${id}/assets?file=${profile.logo}` : '');`
- `page.tsx:96`: `const logoSrc = p.logo ? `/api/profiles/${p.id}/assets?file=${p.logo}` : null;`
- `SettingsPanel.tsx:525`: `setLogoUrl(data.url);` (from API response)

**Issues**:
- **Inconsistent patterns**: Sometimes constructed manually, sometimes from API
- **No validation**: URLs can be malformed if `profile.logo` contains special characters
- **No URL encoding**: Special characters in filenames break URLs
- **Hardcoded paths**: API path is duplicated everywhere

**Alternative Approach**:
```typescript
// Centralized URL builder with validation
class AssetUrlBuilder {
  static build(profileId: string, filename: string | null): string | null {
    if (!filename) return null;
    
    // Validate filename (prevent path traversal)
    if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
      console.error('Invalid filename:', filename);
      return null;
    }
    
    // Encode properly
    const encoded = encodeURIComponent(filename);
    return `/api/profiles/${profileId}/assets?file=${encoded}`;
  }
  
  static parse(url: string | null): { profileId: string; filename: string } | null {
    if (!url) return null;
    
    try {
      const urlObj = new URL(url, window.location.origin);
      const match = urlObj.pathname.match(/\/api\/profiles\/([^/]+)\/assets/);
      if (!match) return null;
      
      return {
        profileId: match[1],
        filename: decodeURIComponent(urlObj.searchParams.get('file') || '')
      };
    } catch {
      return null;
    }
  }
}

// Usage:
setLogoUrl(AssetUrlBuilder.build(id, profile.logo));
```

#### 1.3 Missing Profile Validation
**Problem**: No validation when loading or saving profiles.

**Current Code** (`profiles.ts:41-48`):
```typescript
export async function getProfile(id: string): Promise<AvatarProfile | null> {
    try {
        const configPath = path.join(PROFILES_DIR, id, 'config.json');
        const data = await fs.readFile(configPath, 'utf-8');
        return JSON.parse(data); // No validation!
    } catch {
        return null;
    }
}
```

**Issues**:
- **No schema validation**: Malformed JSON or missing fields cause runtime errors
- **No type checking**: TypeScript types don't validate at runtime
- **Silent failures**: Returns `null` on any error, no distinction between file not found vs invalid data
- **Path traversal vulnerability**: `id` parameter not validated

**Alternative Approach**:
```typescript
import { z } from 'zod'; // Or use a validation library

const AvatarProfileSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  created: z.number().int().positive(),
  updated: z.number().int().positive(),
  avatarConfig: z.object({ /* ... */ }),
  speechConfig: z.object({ /* ... */ }),
  // ... etc
});

export async function getProfile(id: string): Promise<AvatarProfile | null> {
  // Validate ID to prevent path traversal
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    throw new Error('Invalid profile ID');
  }
  
  try {
    const configPath = path.join(PROFILES_DIR, id, 'config.json');
    const data = await fs.readFile(configPath, 'utf-8');
    const parsed = JSON.parse(data);
    
    // Validate schema
    const validated = AvatarProfileSchema.parse(parsed);
    return validated;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Profile validation failed:', error.errors);
      return null;
    }
    // File not found is different from validation error
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error; // Re-throw unexpected errors
  }
}
```

#### 1.4 Race Conditions in Profile Loading
**Problem**: Multiple rapid profile switches can cause race conditions.

**Current Code** (`page.tsx:40-53`):
```typescript
const handleProfileSelect = async (id: string) => {
  if (currentProfile?.id === id) return;
  
  setIsLoading(true);
  const minLoadTime = new Promise(resolve => setTimeout(resolve, 600));
  
  await Promise.all([
    loadProfile(id),
    minLoadTime
  ]);
  
  setIsLoading(false);
};
```

**Issues**:
- **No cancellation**: If user switches profiles rapidly, old requests complete and overwrite new state
- **Artificial delay**: 600ms delay is a hack, not a solution
- **No request deduplication**: Same profile loaded multiple times simultaneously

**Alternative Approach**:
```typescript
// Use AbortController for cancellation
const loadProfileAbortControllerRef = useRef<AbortController | null>(null);

const handleProfileSelect = async (id: string) => {
  if (currentProfile?.id === id) return;
  
  // Cancel previous request
  if (loadProfileAbortControllerRef.current) {
    loadProfileAbortControllerRef.current.abort();
  }
  
  const abortController = new AbortController();
  loadProfileAbortControllerRef.current = abortController;
  
  setIsLoading(true);
  
  try {
    await loadProfile(id, { signal: abortController.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      // Request was cancelled, ignore
      return;
    }
    // Handle real errors
    console.error('Failed to load profile:', error);
  } finally {
    if (!abortController.signal.aborted) {
      setIsLoading(false);
    }
  }
};

// In loadProfile:
const loadProfile = async (id: string, options?: { signal?: AbortSignal }) => {
  const res = await fetch(`/api/profiles/${id}`, { 
    cache: 'no-store',
    signal: options?.signal 
  });
  
  if (options?.signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }
  
  // ... rest of loading
};
```

---

## 2. Avatar Settings Management

### Critical Issues

#### 2.1 Settings Not Persisted Until Explicit Save
**Problem**: Settings changes are only in memory until `saveCurrentProfile()` is called.

**Current Code** (`SettingsContext.tsx:192-236`):
```typescript
const saveCurrentProfile = async () => {
    if (!currentProfile) return;
    
    // Parse logo filename from URL (fragile!)
    let logoFilename = currentProfile.logo;
    if (logoUrl.includes('/api/profiles/')) {
        const url = new URL(logoUrl, window.location.origin);
        logoFilename = url.searchParams.get('file');
    } else if (!logoUrl) {
        logoFilename = null;
    }
    
    // Similar fragile parsing for background...
    
    const updated: AvatarProfile = {
        ...currentProfile,
        avatarConfig,
        speechConfig,
        // ... merge all state
    };
    
    await fetch(`/api/profiles/${currentProfile.id}`, {
        method: 'PUT',
        body: JSON.stringify(updated)
    });
};
```

**Issues**:
- **No auto-save**: Users can lose changes if they navigate away
- **Fragile URL parsing**: Manual URL parsing is error-prone
- **No dirty state tracking**: Can't warn users about unsaved changes
- **No optimistic updates**: UI doesn't reflect saved state immediately
- **No conflict resolution**: If profile changed elsewhere, last write wins

**Alternative Approach**:
```typescript
// Track dirty state
const [dirtyState, setDirtyState] = useState<Set<string>>(new Set());
const [lastSaved, setLastSaved] = useState<Date | null>(null);

// Mark fields as dirty when changed
const setAvatarConfigWithDirty = (config: AvatarConfig) => {
  setAvatarConfig(config);
  setDirtyState(prev => new Set([...prev, 'avatarConfig']));
};

// Auto-save with debouncing
const autoSaveRef = useRef<NodeJS.Timeout | null>(null);

useEffect(() => {
  if (dirtyState.size === 0 || !currentProfile) return;
  
  // Debounce auto-save
  if (autoSaveRef.current) {
    clearTimeout(autoSaveRef.current);
  }
  
  autoSaveRef.current = setTimeout(async () => {
    await saveCurrentProfile();
    setDirtyState(new Set());
    setLastSaved(new Date());
  }, 2000); // Auto-save after 2 seconds of inactivity
  
  return () => {
    if (autoSaveRef.current) {
      clearTimeout(autoSaveRef.current);
    }
  };
}, [dirtyState, currentProfile]);

// Warn before navigation if dirty
useEffect(() => {
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (dirtyState.size > 0) {
      e.preventDefault();
      e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
    }
  };
  
  window.addEventListener('beforeunload', handleBeforeUnload);
  return () => window.removeEventListener('beforeunload', handleBeforeUnload);
}, [dirtyState]);
```

#### 2.2 Fragile URL-to-Filename Parsing
**Problem**: Converting URLs back to filenames is error-prone and duplicated.

**Current Code** (`SettingsContext.tsx:195-211`):
```typescript
// Parse logo filename
let logoFilename = currentProfile.logo;
if (logoUrl.includes('/api/profiles/')) {
    const url = new URL(logoUrl, window.location.origin);
    logoFilename = url.searchParams.get('file');
} else if (!logoUrl) {
    logoFilename = null;
}

// Parse background filename (duplicated logic!)
let bgFilename = currentProfile.background;
if (backgroundUrl && backgroundUrl.includes('/api/profiles/')) {
    const url = new URL(backgroundUrl, window.location.origin);
    bgFilename = url.searchParams.get('file');
} else if (!backgroundUrl) {
    bgFilename = null;
}
```

**Issues**:
- **Duplicated logic**: Same parsing code in multiple places
- **No error handling**: `new URL()` can throw if URL is malformed
- **Assumes URL format**: Breaks if URL structure changes
- **Doesn't handle data URLs**: If user pastes image, `logoUrl` might be a data URL

**Alternative Approach**:
```typescript
// Use the AssetUrlBuilder.parse() from earlier
const extractFilenameFromUrl = (url: string | null): string | null => {
  if (!url) return null;
  
  // Handle data URLs (pasted images)
  if (url.startsWith('data:')) {
    return null; // Data URLs need to be uploaded first
  }
  
  const parsed = AssetUrlBuilder.parse(url);
  return parsed?.filename || null;
};

// In saveCurrentProfile:
const logoFilename = extractFilenameFromUrl(logoUrl);
const bgFilename = extractFilenameFromUrl(backgroundUrl);
```

#### 2.3 No Validation Before Save
**Problem**: Invalid settings can be saved, causing runtime errors later.

**Current Code**: No validation in `saveCurrentProfile()`.

**Issues**:
- **Invalid API keys**: Can save empty or malformed keys
- **Invalid endpoints**: Can save malformed URLs
- **Invalid voice names**: Can save non-existent voice names
- **No required field checks**: Can save incomplete profiles

**Alternative Approach**:
```typescript
const saveCurrentProfile = async () => {
  if (!currentProfile) return;
  
  // Validate all configs
  const speechError = validateSpeechConfig(speechConfig);
  if (speechError) {
    throw new Error(`Speech config invalid: ${speechError}`);
  }
  
  const openAIError = validateAzureOpenAIConfig(openAIConfig);
  if (openAIError) {
    throw new Error(`OpenAI config invalid: ${openAIError}`);
  }
  
  // Validate avatar config
  if (!avatarConfig.character || !['Meg', 'Harry', 'Lisa', 'Jeff'].includes(avatarConfig.character)) {
    throw new Error('Invalid avatar character');
  }
  
  // Validate TTS voice (could check against known voices)
  if (!ttsConfig.voice || !ttsConfig.voice.match(/^[a-z]{2}-[A-Z]{2}-[A-Za-z]+Neural$/)) {
    throw new Error('Invalid TTS voice format');
  }
  
  // ... rest of save logic
};
```

---

## 3. Session Appearance (Background & Icon) Handling

### Critical Issues

#### 3.1 Inconsistent Asset Upload Handling
**Problem**: Logo and background uploads are handled differently, with inconsistent error handling.

**Current Code** (`SettingsPanel.tsx:509-533` for logo, `157-183` for background):
```typescript
// Logo upload
onChange={async (e) => {
    const file = e.target.files?.[0];
    if (file && currentProfileId) {
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await fetch(`/api/profiles/${currentProfileId}/assets`, {
                method: 'POST',
                body: formData
            });
            if (res.ok) {
                const data = await res.json();
                if (data.url) {
                    setLogoUrl(data.url);
                }
            }
        } catch (err) {
            console.error("Failed to upload logo", err);
        }
    }
}}

// Background upload (different handler)
const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!currentProfileId) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const res = await fetch(`/api/profiles/${currentProfileId}/assets`, {
            method: 'POST',
            body: formData
        });
        
        if (!res.ok) throw new Error('Upload failed');
        
        const data = await res.json();
        if (data.url) {
            setBackgroundUrl(data.url);
            refreshBackground(); // Legacy trigger
        }
    } catch (err) {
        console.error('Failed to upload background', err);
    }
};
```

**Issues**:
- **Inconsistent error handling**: Logo upload silently fails, background throws
- **No file validation**: No size limits, type checking, or virus scanning
- **No progress indication**: Large files upload with no feedback
- **No cleanup**: Old files not deleted when new ones uploaded
- **No retry logic**: Network failures are permanent

**Alternative Approach**:
```typescript
// Unified asset upload handler
interface UploadOptions {
  maxSize?: number; // bytes
  allowedTypes?: string[];
  onProgress?: (progress: number) => void;
}

const uploadAsset = async (
  file: File,
  profileId: string,
  options: UploadOptions = {}
): Promise<string> => {
  // Validate file
  if (options.maxSize && file.size > options.maxSize) {
    throw new Error(`File too large. Maximum size: ${options.maxSize / 1024 / 1024}MB`);
  }
  
  if (options.allowedTypes && !options.allowedTypes.includes(file.type)) {
    throw new Error(`Invalid file type. Allowed: ${options.allowedTypes.join(', ')}`);
  }
  
  const formData = new FormData();
  formData.append('file', file);
  
  // Use XMLHttpRequest for progress tracking
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && options.onProgress) {
        const progress = (e.loaded / e.total) * 100;
        options.onProgress(progress);
      }
    });
    
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          if (data.url) {
            resolve(data.url);
          } else {
            reject(new Error('Invalid response from server'));
          }
        } catch {
          reject(new Error('Failed to parse response'));
        }
      } else {
        reject(new Error(`Upload failed: ${xhr.statusText}`));
      }
    });
    
    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'));
    });
    
    xhr.open('POST', `/api/profiles/${profileId}/assets`);
    xhr.send(formData);
  });
};

// Usage with retry logic
const uploadWithRetry = async (
  file: File,
  profileId: string,
  maxRetries = 3
): Promise<string> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await uploadAsset(file, profileId, {
        maxSize: 10 * 1024 * 1024, // 10MB
        allowedTypes: ['image/png', 'image/jpeg', 'image/jpg', 'video/mp4', 'video/webm'],
        onProgress: (progress) => {
          console.log(`Upload progress: ${progress}%`);
        }
      });
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
    }
  }
  throw new Error('Max retries exceeded');
};
```

#### 3.2 No Asset Cleanup
**Problem**: Old assets are never deleted, causing disk space bloat.

**Current Code**: No cleanup logic anywhere.

**Issues**:
- **Disk space waste**: Old logos/backgrounds accumulate
- **No orphan detection**: Files referenced but not in config
- **No cleanup on profile delete**: Assets remain after profile deletion

**Alternative Approach**:
```typescript
// In asset upload route
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const formData = await req.formData();
  const file = formData.get('file') as File;
  
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  
  // Get current profile to find old asset
  const profile = await getProfile(id);
  const assetType = formData.get('assetType') as 'logo' | 'background'; // Need to pass this
  
  // Delete old asset if exists
  if (profile && profile[assetType]) {
    const oldAssetPath = path.join(PROFILES_DIR, id, 'assets', profile[assetType]);
    try {
      await fs.unlink(oldAssetPath);
    } catch (err) {
      // Ignore if file doesn't exist
      console.warn('Failed to delete old asset:', err);
    }
  }
  
  // Upload new asset
  const buffer = Buffer.from(await file.arrayBuffer());
  const cleanName = path.basename(file.name).replace(/[^a-zA-Z0-9.-]/g, '_');
  const filename = `${Date.now()}-${cleanName}`;
  
  const profileDir = await getProfileDir(id);
  const filePath = path.join(profileDir, 'assets', filename);
  
  await fs.writeFile(filePath, buffer);
  
  return NextResponse.json({ url: `/api/profiles/${id}/assets?file=${filename}`, filename });
}

// Cleanup orphaned assets
export async function cleanupOrphanedAssets(profileId: string): Promise<void> {
  const profile = await getProfile(profileId);
  if (!profile) return;
  
  const assetsDir = path.join(PROFILES_DIR, profileId, 'assets');
  const files = await fs.readdir(assetsDir);
  
  const referencedFiles = new Set([
    profile.logo,
    profile.background
  ].filter(Boolean));
  
  for (const file of files) {
    if (!referencedFiles.has(file)) {
      // Orphaned file, delete it
      await fs.unlink(path.join(assetsDir, file));
      console.log(`Deleted orphaned asset: ${file}`);
    }
  }
}
```

#### 3.3 Paste Handler Issues
**Problem**: Paste handlers for logo/background are inconsistent and error-prone.

**Current Code** (`SettingsPanel.tsx:483-500` for logo, `572-592` for background):
```typescript
// Logo paste
onPaste={(e) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
            const blob = items[i].getAsFile();
            if (blob) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    if (event.target?.result) {
                        setLogoUrl(event.target.result as string); // Sets data URL!
                    }
                };
                reader.readAsDataURL(blob);
            }
            break;
        }
    }
}}

// Background paste (different - uploads immediately)
onPaste={(e) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1 || item.type.indexOf('video') !== -1) {
            const file = item.getAsFile();
            if (file && currentProfileId) {
                const formData = new FormData();
                formData.append('file', file);
                fetch(`/api/profiles/${currentProfileId}/assets`, {
                    method: 'POST',
                    body: formData
                }).then(async res => {
                    const data = await res.json();
                    if (data.url) setBackgroundUrl(data.url);
                });
            }
            break;
        }
    }
}}
```

**Issues**:
- **Inconsistent behavior**: Logo sets data URL (not saved), background uploads immediately
- **No error handling**: Background paste has no try/catch
- **No file validation**: Can paste invalid files
- **Memory leaks**: FileReader not cleaned up
- **No user feedback**: Silent failures

**Alternative Approach**:
```typescript
// Unified paste handler
const handleAssetPaste = useCallback(async (
  e: React.ClipboardEvent,
  assetType: 'logo' | 'background'
) => {
  e.preventDefault();
  
  const items = Array.from(e.clipboardData.items);
  const imageItem = items.find(item => 
    item.type.startsWith('image/') || item.type.startsWith('video/')
  );
  
  if (!imageItem) {
    // Show toast: "No image/video found in clipboard"
    return;
  }
  
  if (!currentProfileId) {
    // Show toast: "Please select a profile first"
    return;
  }
  
  const file = imageItem.getAsFile();
  if (!file) return;
  
  // Show loading state
  setIsUploading(true);
  setUploadError(null);
  
  try {
    const url = await uploadWithRetry(file, currentProfileId, {
      maxSize: assetType === 'logo' ? 5 * 1024 * 1024 : 50 * 1024 * 1024, // 5MB logo, 50MB background
      allowedTypes: assetType === 'logo' 
        ? ['image/png', 'image/jpeg', 'image/jpg']
        : ['image/png', 'image/jpeg', 'image/jpg', 'video/mp4', 'video/webm']
    });
    
    if (assetType === 'logo') {
      setLogoUrl(url);
    } else {
      setBackgroundUrl(url);
    }
    
    // Show success toast
  } catch (error) {
    setUploadError(error instanceof Error ? error.message : 'Upload failed');
    // Show error toast
  } finally {
    setIsUploading(false);
  }
}, [currentProfileId]);
```

#### 3.4 Background Component Issues
**Problem**: `AvatarBackground` component has poor error handling and no loading states.

**Current Code** (`AvatarBackground.tsx`):
```typescript
export const AvatarBackground = ({ theme = 'dark', src }: Props) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    
    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.playbackRate = 0.75; // Hardcoded!
        }
    }, [src]);
    
    // No error handling, no loading state
    const isVideo = src.match(/\.(mp4|webm)$/i);
    
    return (
        // ... renders video or image
    );
};
```

**Issues**:
- **No error handling**: Broken images/videos show nothing
- **No loading state**: No indication while assets load
- **Hardcoded playback rate**: Should be configurable
- **Regex-based type detection**: Fragile, breaks with query params
- **No fallback**: If asset fails to load, shows nothing

**Alternative Approach**:
```typescript
export const AvatarBackground = ({ theme = 'dark', src, playbackRate = 0.75 }: Props) => {
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    
    // Better type detection
    const isVideo = useMemo(() => {
        if (!src) return false;
        try {
            const url = new URL(src, window.location.origin);
            const pathname = url.pathname.toLowerCase();
            return pathname.endsWith('.mp4') || pathname.endsWith('.webm');
        } catch {
            return src.toLowerCase().match(/\.(mp4|webm)$/);
        }
    }, [src]);
    
    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.playbackRate = playbackRate;
        }
    }, [src, playbackRate]);
    
    if (!src) {
        return <FallbackBackground theme={theme} />;
    }
    
    if (hasError) {
        return <FallbackBackground theme={theme} />;
    }
    
    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {isLoading && (
                <div className="absolute inset-0 bg-zinc-900/50 animate-pulse" />
            )}
            {isVideo ? (
                <video
                    ref={videoRef}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="absolute inset-0 w-full h-full object-cover"
                    src={src}
                    onLoadedData={() => setIsLoading(false)}
                    onError={() => {
                        setHasError(true);
                        setIsLoading(false);
                    }}
                />
            ) : (
                <Image
                    src={src}
                    alt="Avatar Background"
                    fill
                    className="object-cover"
                    unoptimized
                    onLoad={() => setIsLoading(false)}
                    onError={() => {
                        setHasError(true);
                        setIsLoading(false);
                    }}
                />
            )}
        </div>
    );
};
```

---

## 4. General Architecture Issues

### 4.1 No Migration System
**Problem**: Profile schema changes break existing profiles.

**Solution**: Implement versioning and migration:
```typescript
interface ProfileV1 {
  version: 1;
  // ... old schema
}

interface ProfileV2 {
  version: 2;
  // ... new schema
}

const migrateProfile = (profile: any): AvatarProfile => {
  const version = profile.version || 1;
  
  if (version === 1) {
    // Migrate to v2
    return {
      ...profile,
      version: 2,
      ttsConfig: {
        ...profile.ttsConfig,
        speakingRate: 1.0, // New field with default
      }
    };
  }
  
  return profile;
};
```

### 4.2 No Backup System
**Problem**: Profile corruption or accidental deletion causes data loss.

**Solution**: Implement automatic backups:
```typescript
const backupProfile = async (profileId: string): Promise<void> => {
  const profile = await getProfile(profileId);
  if (!profile) return;
  
  const backupDir = path.join(PROFILES_DIR, profileId, '.backups');
  await fs.mkdir(backupDir, { recursive: true });
  
  const backupPath = path.join(backupDir, `backup-${Date.now()}.json`);
  await fs.writeFile(backupPath, JSON.stringify(profile, null, 2));
  
  // Keep only last 10 backups
  const backups = (await fs.readdir(backupDir))
    .filter(f => f.startsWith('backup-'))
    .sort()
    .reverse();
  
  for (const backup of backups.slice(10)) {
    await fs.unlink(path.join(backupDir, backup));
  }
};
```

---

## Summary of Priority Fixes

1. **Critical**:
   - Fix state synchronization with atomic updates
   - Implement proper URL construction/parsing
   - Add profile validation
   - Fix race conditions in profile loading

2. **High Priority**:
   - Implement auto-save with dirty state tracking
   - Add asset cleanup on upload/delete
   - Unify asset upload handling
   - Add error handling and loading states

3. **Medium Priority**:
   - Add file validation and size limits
   - Implement retry logic for uploads
   - Add progress indicators
   - Improve paste handler consistency

4. **Low Priority**:
   - Add migration system
   - Implement backup system
   - Add asset optimization (compression, resizing)
   - Add CDN support for assets

