import React from 'react';

type Props = {
    theme: 'dark' | 'light';
    isVisible: boolean;
    message?: string;
};

export const LoadingOverlay = ({ theme, isVisible, message = 'Connecting...' }: Props) => {
    if (!isVisible) return null;

    return (
        <div className={`absolute inset-0 z-50 flex items-center justify-center ${theme === 'light' ? 'bg-zinc-50/80' : 'bg-zinc-950/80'} backdrop-blur-sm`}>
            <div className="flex flex-col items-center gap-4">
                <div className={`w-12 h-12 rounded-full border-4 ${theme === 'light' ? 'border-emerald-100 border-t-emerald-600' : 'border-emerald-900/30 border-t-emerald-500'} animate-spin`} />
                <p className={`text-sm font-light tracking-wider animate-pulse ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'}`}>
                    {message}
                </p>
            </div>
        </div>
    );
};
