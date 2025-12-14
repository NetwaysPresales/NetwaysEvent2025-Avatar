/**
 * Asset URL Builder
 * 
 * Centralized utility for building and parsing asset URLs.
 * Prevents URL construction inconsistencies and validates inputs.
 */

/**
 * Build asset URL from profile ID and asset type
 */
export function buildAssetUrl(
  profileId: string,
  assetType: 'logo' | 'background',
  expiresInMinutes?: number
): string {
  const params = new URLSearchParams();
  params.set('assetType', assetType);
  if (expiresInMinutes) {
    params.set('expiresInMinutes', expiresInMinutes.toString());
  }
  return `/api/profiles/${profileId}/assets?${params.toString()}`;
}

/**
 * Parse asset URL to extract profile ID and asset type
 */
export function parseAssetUrl(url: string | null): { profileId: string; assetType: 'logo' | 'background' } | null {
  if (!url) return null;

  try {
    const urlObj = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'https://placeholder.com');
    const match = urlObj.pathname.match(/\/api\/profiles\/([^/]+)\/assets/);
    if (!match) return null;

    const assetType = urlObj.searchParams.get('assetType') as 'logo' | 'background' | null;
    if (!assetType || (assetType !== 'logo' && assetType !== 'background')) {
      return null;
    }

    return {
      profileId: match[1],
      assetType,
    };
  } catch {
    return null;
  }
}

/**
 * Extract filename from asset URL (legacy support)
 */
export function extractFilenameFromUrl(url: string | null): string | null {
  if (!url) return null;

  try {
    const urlObj = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'https://placeholder.com');
    return urlObj.searchParams.get('file');
  } catch {
    // Fallback: try to extract from path
    const parts = url.split('/');
    return parts[parts.length - 1] || null;
  }
}

