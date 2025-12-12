
import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';

type Props = {
    theme?: 'dark' | 'light';
    appTitle: string;
    appDescription: string;
    logoUrl: string;
    onStart: () => void;
    onOpenSettings: () => void;
    onToggleTheme: () => void;
};

export const StartScreen = ({
    theme = 'light',
    appTitle,
    appDescription,
    logoUrl,
    onStart,
    onOpenSettings,
    onToggleTheme
}: Props) => {
    return (
        <div className="absolute inset-x-0 bottom-0 top-0 flex flex-col items-center justify-center p-6 z-20">
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="w-full max-w-md flex flex-col items-center gap-12"
            >
                {/* Hero Section */}
                <div className="text-center space-y-4">
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="w-48 h-48 mx-auto flex items-center justify-center mb-6"
                    >
                        <Image
                            src={logoUrl || "/logo.png"}
                            alt="Logo"
                            width={180}
                            height={180}
                            className="object-contain drop-shadow-xl"
                            priority
                            style={{ width: 'auto', height: 'auto' }}
                        />
                    </motion.div>

                    <h1 className={`text-4xl md:text-5xl font-light tracking-tight ${theme === 'light' ? 'text-zinc-900' : 'text-white'} whitespace-nowrap`}>
                        {appTitle}
                    </h1>
                    <p className={`${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'} text-lg font-light tracking-wide max-w-sm mx-auto leading-relaxed`}>
                        {appDescription}
                    </p>
                </div>

                {/* Start Button */}
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onStart}
                    className={`group mt-8 relative px-8 py-4 ${theme === 'light' ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-900'} rounded-full font-medium tracking-wide shadow-2xl ${theme === 'light' ? 'shadow-zinc-900/20' : 'shadow-white/10'} transition-all overflow-hidden w-64 text-center`}
                >
                    <span className="relative z-10 flex items-center justify-center gap-2">
                        Start Session
                        <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                    </span>
                    <div className={`absolute inset-0 ${theme === 'light' ? 'bg-zinc-800' : 'bg-zinc-100'} opacity-0 group-hover:opacity-100 transition-opacity`} />
                </motion.button>

                {/* Footer Actions */}
                <div className="flex gap-4 pt-8">
                    <button
                        onClick={onToggleTheme}
                        className={`p-3 rounded-full ${theme === 'light' ? 'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'} transition-all`}
                    >
                        {theme === 'light' ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                        ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                        )}
                    </button>
                    <button
                        onClick={onOpenSettings}
                        className={`p-3 rounded-full ${theme === 'light' ? 'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'} transition-all`}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </button>
                </div>
            </motion.div>
        </div>
    );
};
