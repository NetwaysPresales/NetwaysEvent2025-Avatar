import React, { useEffect, useRef } from 'react';
import Image from 'next/image';

type Props = {
    theme?: 'dark' | 'light';
    src?: string | null;
};

export const AvatarBackground = ({ theme = 'dark', src }: Props) => {
    const videoRef = useRef<HTMLVideoElement>(null);

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
