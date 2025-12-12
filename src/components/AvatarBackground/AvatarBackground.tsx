import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

type Props = {
    theme?: 'dark' | 'light';
    refreshTrigger?: number; // Optional prop to force consistency if needed
};

export const AvatarBackground = ({ theme = 'dark', refreshTrigger }: Props) => {
    const [url, setUrl] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    const fetchBackground = async () => {
        try {
            const res = await fetch('/api/avatar/background?t=' + Date.now()); // Cache bust
            const data = await res.json();
            setUrl(data.url);
        } catch (error) {
            console.error('Failed to fetch background:', error);
            setUrl(null);
        }
    };

    useEffect(() => {
        fetchBackground();
    }, [refreshTrigger]);

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.playbackRate = 0.75;
        }
    }, [url]);

    if (!url) {
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

    const isVideo = url.match(/\.(mp4|webm)$/i);

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
                    src={url}
                />
            ) : (
                <Image
                    src={url}
                    alt="Avatar Background"
                    fill
                    className="object-cover"
                    unoptimized
                />
            )}
        </div>
    );
};
