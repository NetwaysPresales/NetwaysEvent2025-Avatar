/**
 * Profile Context
 * 
 * Manages profile state with a state machine approach for atomic updates.
 * Consolidates ALL profile information and operations in one place.
 */

'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { useSession } from 'next-auth/react';
import type { Profile } from '@/types/profile';
import type { AvatarConfig, SpeechConfig, TTSConfig, AzureOpenAIConfig } from '@/types/avatar';
import { AccentColor, generateAccentPalette, applyAccentColor, applyTheme } from '@/lib/theme';
import { hydrateProfile, type HydratedProfile } from '@/services/profile-hydration';
import { extractBlobUrl } from '@/lib/asset-url-utils';

/**
 * Profile state machine
 */
type ProfileState =
  | { type: 'idle' }
  | { type: 'loading'; profileId: string }
  | { type: 'loaded'; profile: Profile; hydrated: HydratedProfile }
  | { type: 'error'; error: Error; previousProfile?: Profile };

export interface KnowledgeFileSummary {
  id: string;
  filename: string;
  indexed: boolean;
  chunkCount: number;
  indexedAt: string | null;
  uploadedAt: string;
}

interface ProfileContextType {
  // State
  profileState: ProfileState;
  profiles: Profile[];
  isLoadingProfiles: boolean;
  
  // Actions
  loadProfile: (id: string) => Promise<void>;
  refreshProfiles: () => Promise<Profile[]>;
  saveProfile: () => Promise<void>;
  createProfile: (name: string) => Promise<Profile | null>;
  deleteProfile: (id: string) => Promise<void>;
  
  // Knowledge base operations
  fetchKnowledgeFiles: (profileId: string) => Promise<KnowledgeFileSummary[]>;
  deleteKnowledgeFile: (profileId: string, fileId: string) => Promise<void>;
  
  // Current profile data (derived from state)
  currentProfile: Profile | null;
  hydrated: HydratedProfile | null;
  
  // Config setters (update hydrated state)
  setSpeechConfig: (config: SpeechConfig) => void;
  setAvatarConfig: (config: AvatarConfig) => void;
  setTTSConfig: (config: TTSConfig) => void;
  setOpenAIConfig: (config: AzureOpenAIConfig) => void;
  setAppTitle: (title: string) => void;
  setProfileName: (name: string) => void;
  setAppDescription: (description: string) => void;
  setLogoUrl: (url: string | null) => void;
  setBackgroundUrl: (url: string | null) => void;
  setLogoShowContainer: (show: boolean) => void;
  setShowEvidencePanel: (show: boolean) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
  setAccentColor: (color: AccentColor | null) => void;
  
  // UI state
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export const ProfileProvider = ({ children }: { children: ReactNode }) => {
  const { data: session, status: sessionStatus } = useSession();
  const [profileState, setProfileState] = useState<ProfileState>({ type: 'idle' });
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(true);
  
  // Abort controller for cancelling in-flight requests
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Track if we've already loaded profiles to avoid duplicate loads
  const hasLoadedProfilesRef = useRef(false);

  // Derived state
  const currentProfile = profileState.type === 'loaded' ? profileState.profile : null;
  const hydrated = profileState.type === 'loaded' ? profileState.hydrated : null;

  // Apply theme and accent color when profile changes
  useEffect(() => {
    if (hydrated) {
      applyTheme(hydrated.appearance.theme);
      const palette = generateAccentPalette(hydrated.appearance.accentColor);
      applyAccentColor(palette);
      
      // Update document title
      document.title = hydrated.appearance.appTitle;
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) {
        metaDesc.setAttribute('content', hydrated.appearance.appDescription);
      }
    }
  }, [hydrated]);

  // Refresh profiles list
  const refreshProfiles = useCallback(async (): Promise<Profile[]> => {
    setIsLoadingProfiles(true);
    try {
      const res = await fetch('/api/profiles', { cache: 'no-store' });
      
      // If unauthorized, let middleware handle redirect (don't do client-side redirect here)
      if (res.status === 401) {
        console.warn('Unauthorized - middleware should redirect');
        return [];
      }
      
      if (!res.ok) {
        throw new Error(`Failed to fetch profiles: ${res.statusText}`);
      }
      
      const data = await res.json();
      if (data.profiles) {
        setProfiles(data.profiles);
        return data.profiles;
      }
      return [];
    } catch (error) {
      console.error('Failed to refresh profiles', error);
      return [];
    } finally {
      setIsLoadingProfiles(false);
    }
  }, []);

  // Load a specific profile
  const loadProfile = useCallback(async (id: string) => {
    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setProfileState({ type: 'loading', profileId: id });

    try {
      const res = await fetch(`/api/profiles/${id}`, {
        cache: 'no-store',
        signal: abortController.signal,
      });

      if (!res.ok) {
        throw new Error(`Failed to load profile: ${res.statusText}`);
      }

      const profile = await res.json();
      
      if (abortController.signal.aborted) {
        return; // Request was cancelled
      }

      if (profile && !profile.error) {
        const hydrated = hydrateProfile(profile);
        setProfileState({ type: 'loaded', profile, hydrated });
        
        // Update the profile in the profiles list to ensure consistency
        // This ensures card metadata matches the loaded profile data
        // CRITICAL: Always replace the profile in the list to ensure avatarConfig is correct
        // Ensure avatarConfig is properly parsed (Prisma JsonValue might be a string)
        // Also ensure it has the correct structure with character and style
        let parsedAvatarConfig: AvatarConfig;
        if (typeof profile.avatarConfig === 'string') {
          parsedAvatarConfig = JSON.parse(profile.avatarConfig) as AvatarConfig;
        } else if (profile.avatarConfig && typeof profile.avatarConfig === 'object') {
          parsedAvatarConfig = profile.avatarConfig as AvatarConfig;
        } else {
          // Fallback to default if avatarConfig is invalid
          const { getDefaultAvatarConfig } = await import('@/lib/config');
          parsedAvatarConfig = getDefaultAvatarConfig();
        }
        
        const parsedProfile: Profile = {
          ...profile,
          avatarConfig: parsedAvatarConfig,
        };
        
        // Debug log to verify avatarConfig is correct
        console.log('[ProfileContext] Updating profiles list with profile:', {
          id: parsedProfile.id,
          name: parsedProfile.name,
          character: parsedProfile.avatarConfig?.character,
          style: parsedProfile.avatarConfig?.style,
        });
        
        setProfiles((prevProfiles) => {
          const existingIndex = prevProfiles.findIndex(p => p.id === parsedProfile.id);
          if (existingIndex >= 0) {
            // Replace existing profile with fresh data from database
            const updated = [...prevProfiles];
            updated[existingIndex] = parsedProfile;
            return updated;
          } else {
            // Add new profile to the list
            return [...prevProfiles, parsedProfile];
          }
        });
        
        // Save last used profile ID
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('lastProfileId', id);
        }

        // Entity metadata is small and still benefits from eager loading.
        import('@/hooks/useEntityCache')
          .then((module) => module.preloadEntities(id))
          .catch((err) => console.error('[ProfileContext] Failed to preload entities:', err));
      } else {
        throw new Error('Profile not found');
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        return; // Request was cancelled, ignore
      }
      
      // Use functional update to avoid stale closure
      setProfileState((prevState) => {
        const previousProfile = prevState.type === 'loaded' ? prevState.profile : undefined;
        return {
          type: 'error',
          error: error instanceof Error ? error : new Error('Failed to load profile'),
          previousProfile,
        };
      });
    }
  }, []); // Remove profileState dependency to avoid stale closures

  // Save current profile
  const saveProfile = useCallback(async () => {
    if (profileState.type !== 'loaded' || !hydrated) {
      return;
    }

    try {
      const profile = profileState.profile;
      
      // Extract blob URLs from hydrated state
      // When setLogoUrl/setBackgroundUrl is called with a blob URL from AssetUpload,
      // it stores the blob URL. If it's an API endpoint URL, the blob URL hasn't changed.
      const logoBlobUrl = extractBlobUrl(hydrated.appearance.logoUrl, profile.logoBlobUrl);
      const backgroundBlobUrl = extractBlobUrl(hydrated.appearance.backgroundUrl, profile.backgroundBlobUrl);

      const updated: Partial<Profile> = {
        name: profile.name,
        avatarConfig: hydrated.avatarConfig,
        speechConfig: hydrated.speechConfig,
        ttsConfig: hydrated.ttsConfig,
        openaiConfig: hydrated.openaiConfig,
        sttConfig: hydrated.sttConfig,
        appTitle: hydrated.appearance.appTitle,
        appDescription: hydrated.appearance.appDescription,
        theme: hydrated.appearance.theme,
        accentColor: hydrated.appearance.accentColor,
        logoShowContainer: hydrated.appearance.logoShowContainer,
        showEvidencePanel: hydrated.appearance.showEvidencePanel,
        logoBlobUrl,
        backgroundBlobUrl,
      };

      const res = await fetch(`/api/profiles/${profile.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });

      if (!res.ok) {
        throw new Error(`Failed to save profile: ${res.statusText}`);
      }

      // Get the updated profile from the response
      const responseData = await res.json();
      const savedProfile = responseData.profile;
      
      if (savedProfile) {
        // Immediately update the profiles list with the saved data to keep card metadata in sync
        setProfiles((prevProfiles) => {
          return prevProfiles.map(p => p.id === profile.id ? savedProfile : p);
        });
      }

      // Reload profile to get updated data (this will also update the profiles list)
      await loadProfile(profile.id);
      
      // Refresh profiles list to ensure everything is in sync
      await refreshProfiles();
    } catch (error) {
      console.error('Failed to save profile', error);
      throw error;
    }
  }, [profileState, hydrated, loadProfile, refreshProfiles]);

  // Create new profile
  const createProfile = useCallback(async (name: string): Promise<Profile | null> => {
    try {
      const res = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });

      if (!res.ok) {
        throw new Error(`Failed to create profile: ${res.statusText}`);
      }

      const data = await res.json();
      if (data.profile) {
        const newProfileId = data.profile.id;
        
        // Load the profile immediately to ensure it's properly hydrated and added to the list
        // with correct avatarConfig (character, style) from the database
        // This ensures the card shows the correct metadata immediately
        // loadProfile will fetch the profile from GET /api/profiles/[id] which ensures
        // proper JSON serialization of avatarConfig, and update the profiles list
        await loadProfile(newProfileId);
        
        // After loadProfile completes, the profiles list should be updated
        // Return the profile from the loaded state (which has correct avatarConfig)
        // We can't read from state here, but loadProfile already updated it
        // The return value is mainly for the caller to know the profile was created
        return data.profile;
      }
      return null;
    } catch (error) {
      console.error('Failed to create profile', error);
      return null;
    }
  }, [loadProfile]);

  // Delete profile
  // Note: Confirmation is handled by DeleteProfileConfirmation component
  const deleteProfile = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/profiles/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        throw new Error('Failed to delete profile');
      }

      const remaining = await refreshProfiles();
      
      // If deleted profile was current, load another or reset
      setProfileState((prevState) => {
        if (prevState.type === 'loaded' && prevState.profile.id === id) {
          if (remaining.length > 0) {
            // Load first remaining profile
            loadProfile(remaining[0].id).catch(console.error);
            return { type: 'loading', profileId: remaining[0].id };
          } else {
            return { type: 'idle' };
          }
        }
        return prevState;
      });
    } catch (error) {
      console.error('Failed to delete profile', error);
      throw error;
    }
  }, [loadProfile, refreshProfiles]);

  // Knowledge base operations
  const fetchKnowledgeFiles = useCallback(async (profileId: string): Promise<KnowledgeFileSummary[]> => {
    try {
      const res = await fetch(`/api/profiles/${profileId}/knowledge`);
      const data = await res.json();
      const files = data.files || [];
      return Array.isArray(files) ? files : [];
    } catch (error) {
      console.error('Failed to fetch knowledge files', error);
      return [];
    }
  }, []);

  const deleteKnowledgeFile = useCallback(async (profileId: string, fileId: string): Promise<void> => {
    try {
      const res = await fetch(`/api/profiles/${profileId}/knowledge?fileId=${encodeURIComponent(fileId)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        throw new Error('Delete failed');
      }
    } catch (error) {
      console.error('Failed to delete knowledge file', error);
      throw error;
    }
  }, []);

  // Config setters (update hydrated state)
  const setSpeechConfig = useCallback((config: SpeechConfig) => {
    setProfileState((prevState) => {
      if (prevState.type === 'loaded') {
        return {
          ...prevState,
          hydrated: {
            ...prevState.hydrated,
            speechConfig: config,
          },
        };
      }
      return prevState;
    });
  }, []);

  const setAvatarConfig = useCallback((config: AvatarConfig) => {
    setProfileState((prevState) => {
      if (prevState.type === 'loaded') {
        return {
          ...prevState,
          hydrated: {
            ...prevState.hydrated,
            avatarConfig: config,
          },
        };
      }
      return prevState;
    });
  }, []);

  const setTTSConfig = useCallback((config: TTSConfig) => {
    setProfileState((prevState) => {
      if (prevState.type === 'loaded') {
        return {
          ...prevState,
          hydrated: {
            ...prevState.hydrated,
            ttsConfig: config,
          },
        };
      }
      return prevState;
    });
  }, []);

  const setOpenAIConfig = useCallback((config: AzureOpenAIConfig) => {
    setProfileState((prevState) => {
      if (prevState.type === 'loaded') {
        return {
          ...prevState,
          hydrated: {
            ...prevState.hydrated,
            openaiConfig: config,
          },
        };
      }
      return prevState;
    });
  }, []);

  const setAppTitle = useCallback((title: string) => {
    setProfileState((prevState) => {
      if (prevState.type === 'loaded') {
        return {
          ...prevState,
          hydrated: {
            ...prevState.hydrated,
            appearance: {
              ...prevState.hydrated.appearance,
              appTitle: title,
            },
          },
        };
      }
      return prevState;
    });
  }, []);

  const setAppDescription = useCallback((description: string) => {
    setProfileState((prevState) => {
      if (prevState.type === 'loaded') {
        return {
          ...prevState,
          hydrated: {
            ...prevState.hydrated,
            appearance: {
              ...prevState.hydrated.appearance,
              appDescription: description,
            },
          },
        };
      }
      return prevState;
    });
  }, []);

  const setLogoUrl = useCallback((url: string | null) => {
    setProfileState((prevState) => {
      if (prevState.type === 'loaded') {
        return {
          ...prevState,
          hydrated: {
            ...prevState.hydrated,
            appearance: {
              ...prevState.hydrated.appearance,
              logoUrl: url,
            },
          },
        };
      }
      return prevState;
    });
  }, []);

  const setBackgroundUrl = useCallback((url: string | null) => {
    setProfileState((prevState) => {
      if (prevState.type === 'loaded') {
        return {
          ...prevState,
          hydrated: {
            ...prevState.hydrated,
            appearance: {
              ...prevState.hydrated.appearance,
              backgroundUrl: url,
            },
          },
        };
      }
      return prevState;
    });
  }, []);

  const setLogoShowContainer = useCallback((show: boolean) => {
    setProfileState((prevState) => {
      if (prevState.type === 'loaded') {
        return {
          ...prevState,
          hydrated: {
            ...prevState.hydrated,
            appearance: {
              ...prevState.hydrated.appearance,
              logoShowContainer: show,
            },
          },
        };
      }
      return prevState;
    });
  }, []);

  const setProfileName = useCallback((name: string) => {
    setProfileState((prevState) => prevState.type === 'loaded'
      ? { ...prevState, profile: { ...prevState.profile, name } }
      : prevState);
    setProfiles((current) => current.map((profile) => (
      profileState.type === 'loaded' && profile.id === profileState.profile.id
        ? { ...profile, name }
        : profile
    )));
  }, [profileState]);

  const setShowEvidencePanel = useCallback((show: boolean) => {
    setProfileState((prevState) => {
      if (prevState.type === 'loaded') {
        return {
          ...prevState,
          hydrated: {
            ...prevState.hydrated,
            appearance: {
              ...prevState.hydrated.appearance,
              showEvidencePanel: show,
            },
          },
        };
      }
      return prevState;
    });
  }, []);

  const setTheme = useCallback((theme: 'light' | 'dark') => {
    setProfileState((prevState) => {
      if (prevState.type === 'loaded') {
        // Immediately apply theme for instant feedback
        applyTheme(theme);
        const palette = generateAccentPalette(prevState.hydrated.appearance.accentColor);
        applyAccentColor(palette);
        
        return {
          ...prevState,
          hydrated: {
            ...prevState.hydrated,
            appearance: {
              ...prevState.hydrated.appearance,
              theme,
            },
          },
        };
      }
      return prevState;
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setProfileState((prevState) => {
      if (prevState.type === 'loaded') {
        const newTheme = prevState.hydrated.appearance.theme === 'light' ? 'dark' : 'light';
        // Immediately apply theme for instant feedback
        applyTheme(newTheme);
        const palette = generateAccentPalette(prevState.hydrated.appearance.accentColor);
        applyAccentColor(palette);
        
        return {
          ...prevState,
          hydrated: {
            ...prevState.hydrated,
            appearance: {
              ...prevState.hydrated.appearance,
              theme: newTheme,
            },
          },
        };
      }
      return prevState;
    });
  }, []);

  const setAccentColor = useCallback((color: AccentColor | null) => {
    setProfileState((prevState) => {
      if (prevState.type === 'loaded') {
        return {
          ...prevState,
          hydrated: {
            ...prevState.hydrated,
            appearance: {
              ...prevState.hydrated.appearance,
              accentColor: color,
            },
          },
        };
      }
      return prevState;
    });
  }, []);

  // Load profiles when session becomes authenticated
  useEffect(() => {
    // Only load profiles if we have an authenticated session and haven't loaded yet
    if (sessionStatus === 'authenticated' && session && !hasLoadedProfilesRef.current) {
      let mounted = true;
      
      (async () => {
        const refreshedProfiles = await refreshProfiles();
        hasLoadedProfilesRef.current = true;
        
        if (!mounted || refreshedProfiles.length === 0) return;
        
        if (typeof window !== 'undefined') {
          const lastId = window.localStorage.getItem('lastProfileId');
          const profileToLoad = lastId && refreshedProfiles.some(p => p.id === lastId)
            ? lastId
            : refreshedProfiles[0].id;
          
          // Set loading state immediately for better UX
          setProfileState({ type: 'loading', profileId: profileToLoad });
          
          // Load immediately without delay
          await loadProfile(profileToLoad);
        }
      })();

      return () => {
        mounted = false;
      };
    }
    // Reset when session becomes unauthenticated
    else if (sessionStatus === 'unauthenticated') {
      hasLoadedProfilesRef.current = false;
      setProfiles([]);
      setProfileState({ type: 'idle' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStatus, session]); // Re-run when session status changes

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return (
    <ProfileContext.Provider
      value={{
        profileState,
        profiles,
        isLoadingProfiles,
        loadProfile,
        refreshProfiles,
        saveProfile,
        createProfile,
        deleteProfile,
        fetchKnowledgeFiles,
        deleteKnowledgeFile,
        currentProfile,
        hydrated,
        setSpeechConfig,
        setAvatarConfig,
        setTTSConfig,
        setOpenAIConfig,
        setAppTitle,
        setProfileName,
        setAppDescription,
        setLogoUrl,
        setBackgroundUrl,
        setLogoShowContainer,
        setShowEvidencePanel,
        setTheme,
        toggleTheme,
        setAccentColor,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
};
