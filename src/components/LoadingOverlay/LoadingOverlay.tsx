'use client';

import React from 'react';
import { useTheme } from '@/hooks/useTheme';

type Props = {
    isVisible: boolean;
    message?: string;
    isClosing?: boolean;
};

export const LoadingOverlay = ({ isVisible, message = 'Connecting...', isClosing = false }: Props) => {
    const theme = useTheme();
    if (!isVisible) return null;

    // Make overlay fully opaque when closing to hide the black video square
    const bgClass = isClosing
        ? (theme === 'light' ? 'bg-zinc-50' : 'bg-zinc-950')
        : (theme === 'light' ? 'bg-zinc-50/80' : 'bg-zinc-950/80');

    return (
        <div className={`absolute inset-0 z-50 flex items-center justify-center ${bgClass} backdrop-blur-sm`}>
            <div className="flex flex-col items-center gap-4">
                <div className={`w-12 h-12 rounded-full border-4 ${theme === 'light' ? 'border-[var(--accent-primary-light)] border-t-[var(--accent-primary-dark)]' : 'border-[var(--accent-primary-light)] border-t-[var(--accent-primary)]'} animate-spin`} />
                <p className={`text-sm font-light tracking-wider animate-pulse ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'}`}>
                    {message}
                </p>
            </div>
        </div>
    );
};
