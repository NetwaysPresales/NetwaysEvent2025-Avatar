/**
 * Theme Hook
 * 
 * Provides theme from profile context
 */

'use client';

import { useProfile } from '@/context/ProfileContext';

export function useTheme(): 'light' | 'dark' {
  const { hydrated } = useProfile();
  return hydrated?.appearance.theme || 'light';
}

