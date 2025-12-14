'use client';

import React, { useEffect, useRef } from 'react';
import Image from 'next/image';
import { useTheme } from '@/hooks/useTheme';
import { useMediaUrl } from '@/hooks/useMediaUrl';

type Props = {
    backgroundUrl?: string | null;
};

/**
 * Check if a URL is a blob storage URL (needs SAS token)
 */
function isBlobUrl(url: string | null): boolean {
  if (!url) return false;
  // Check if it's an Azure Blob Storage URL
  return url.includes('.blob.core.windows.net') && !url.includes('?sig=');
}

export const AvatarBackground = ({ backgroundUrl }: Props) => {
    const theme = useTheme();
    const videoRef = useRef<HTMLVideoElement>(null);
    
    // If it's a blob URL, convert it to SAS URL
    const isBlob = isBlobUrl(backgroundUrl);
    const authenticatedUrl = useMediaUrl(isBlob ? backgroundUrl : null, { enabled: isBlob });
    
    // Use authenticated URL if available, otherwise use original (API endpoint or already SAS URL)
    const src = authenticatedUrl || backgroundUrl;

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.playbackRate = 0.75;
        }
    }, [src]);

    if (!src) {
        // Fallback to solid/gradient based on theme
        return (
            <div className={`absolute inset-0 pointer-events-none ${theme === 'light' ? 'bg-zinc-50' : 'bg-black'}`}>
                {/* Optional subtle gradient to not be completely flat */}
                <div
                    className="absolute inset-0"
                    style={{
                        background: theme === 'light'
                            ? 'radial-gradient(circle at 50% 50%, #ffffff 0%, #f4f4f5 100%)'
                            : 'radial-gradient(circle at 50% 50%, #27272a 0%, #000000 100%)',
                    }}
                />
            </div>
        );
    }

    const isVideo = src.match(/\.(mp4|webm)$/i);

    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {isVideo ? (
                <video
                    ref={videoRef}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="absolute inset-0 w-full h-full object-cover"
                    src={src}
                />
            ) : (
                <Image
                    src={src}
                    alt="Avatar Background"
                    fill
                    className="object-cover"
                    unoptimized
                />
            )}
        </div>
    );
};
