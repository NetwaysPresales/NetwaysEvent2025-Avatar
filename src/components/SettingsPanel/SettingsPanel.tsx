
import React, { Dispatch, SetStateAction, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { AvatarBackground } from '@/components/AvatarBackground';
import type { AvatarConfig, SpeechConfig, AzureOpenAIConfig, TTSConfig } from '@/types/avatar';

type Props = {
    theme: 'dark' | 'light';
    isOpen: boolean;
    onClose: () => void;
    isConnected: boolean;

    // Settings States
    avatarConfig: AvatarConfig;
    setAvatarConfig: Dispatch<SetStateAction<AvatarConfig>>;

    speechConfig: SpeechConfig;
    setSpeechConfig: Dispatch<SetStateAction<SpeechConfig>>;

    openAIConfig: AzureOpenAIConfig;
    setOpenAIConfig: Dispatch<SetStateAction<AzureOpenAIConfig>>;

    ttsConfig: TTSConfig;
    setTTSConfig: Dispatch<SetStateAction<TTSConfig>>;

    // App Settings
    appTitle: string;
    setAppTitle: Dispatch<SetStateAction<string>>;
    appDescription: string;
    setAppDescription: Dispatch<SetStateAction<string>>;
    logoUrl: string;
    setLogoUrl: Dispatch<SetStateAction<string>>;

    // Background Settings
    bgRefreshTrigger: number;
    refreshBackground: () => void;
    backgroundUrl: string | null;
    setBackgroundUrl: Dispatch<SetStateAction<string | null>>;

    // Visibility States
    showSpeechApiKey: boolean;
    setShowSpeechApiKey: Dispatch<SetStateAction<boolean>>;
    showOpenAIApiKey: boolean;
    setShowOpenAIApiKey: Dispatch<SetStateAction<boolean>>;

    // We need currentProfileId for uploads
    currentProfileId: string | undefined;
    onSavePromise: () => Promise<void>;

};



export const SettingsPanel = ({
    theme,
    isOpen,
    onClose,
    isConnected,
    avatarConfig,
    setAvatarConfig,
    speechConfig,
    setSpeechConfig,
    openAIConfig,
    setOpenAIConfig,
    ttsConfig,
    setTTSConfig,
    appTitle,
    setAppTitle,
    appDescription,
    setAppDescription,
    logoUrl,
    setLogoUrl,
    bgRefreshTrigger,
    refreshBackground,
    backgroundUrl,
    setBackgroundUrl,
    showSpeechApiKey,
    setShowSpeechApiKey,
    showOpenAIApiKey,
    setShowOpenAIApiKey,
    currentProfileId,
    onSavePromise
}: Props) => {
    // Tab state
    const [activeTab, setActiveTab] = useState<'settings' | 'appearance' | 'knowledge'>('settings');

    // ... existing state ...

    const [knowledgeFiles, setKnowledgeFiles] = useState<string[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    // Helper to extract filename for display
    const getBgFilename = () => {
        if (!backgroundUrl) return null;
        try {
            const url = new URL(backgroundUrl, 'http://localhost');
            return url.searchParams.get('file');
        } catch {
            return 'Custom Background';
        }
    };
    const bgFilename = getBgFilename();

    // Fetch knowledge files on open or tab switch
    useEffect(() => {
        if (isOpen && activeTab === 'knowledge') {
            fetchKnowledgeFiles();
        }
    }, [isOpen, activeTab]);

    const fetchKnowledgeFiles = async () => {
        try {
            if (!currentProfileId) return;
            const res = await fetch(`/api/profiles/${currentProfileId}/knowledge`);
            const data = await res.json();
            if (data.files) {
                setKnowledgeFiles(data.files);
            }
        } catch (err) {
            console.error('Failed to fetch knowledge files', err);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!currentProfileId) return;

        setIsUploading(true);
        setUploadError(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch(`/api/profiles/${currentProfileId}/knowledge`, {
                method: 'POST',
                body: formData
            });

            if (!res.ok) throw new Error('Upload failed');

            await fetchKnowledgeFiles();
            // Clear input
            e.target.value = '';
        } catch {
            setUploadError('Failed to upload file');
        } finally {
            setIsUploading(false);
        }
    };

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
                // Update local state directly with the new URL
                setBackgroundUrl(data.url);
                refreshBackground(); // Legacy trigger just in case
            }
        } catch (err) {
            console.error('Failed to upload background', err);
        }
    };

    const handleDeleteFile = async (filename: string) => {
        if (!currentProfileId) return;
        if (!confirm(`Delete ${filename}?`)) return;

        try {
            await fetch(`/api/profiles/${currentProfileId}/knowledge?filename=` + encodeURIComponent(filename), {
                method: 'DELETE'
            });
            await fetchKnowledgeFiles();
        } catch (err) {
            console.error('Failed to delete file', err);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-sm">
            <div className={`${theme === 'light' ? 'bg-white border-zinc-300' : 'bg-zinc-900 border-zinc-800'} border rounded-2xl shadow-2xl max-w-2xl w-full h-[700px] ring-1 ${theme === 'light' ? 'ring-zinc-200' : 'ring-white/10'} overflow-hidden flex flex-col`}>
                <div className={`sticky top-0 ${theme === 'light' ? 'bg-white/95' : 'bg-zinc-900/95'} backdrop-blur-md border-b ${theme === 'light' ? 'border-zinc-200' : 'border-zinc-800'} px-6 py-4 flex items-center justify-between z-10`}>
                    <div className="flex gap-6">
                        <button
                            onClick={() => setActiveTab('settings')}
                            className={`relative text-xl font-light tracking-wide transition-colors ${activeTab === 'settings' ? (theme === 'light' ? 'text-zinc-900' : 'text-zinc-100') : (theme === 'light' ? 'text-zinc-400 hover:text-zinc-600' : 'text-zinc-500 hover:text-zinc-300')}`}
                        >
                            Settings
                            {activeTab === 'settings' && (
                                <motion.div
                                    layoutId="activeTab"
                                    className="absolute -bottom-1 left-0 right-0 h-0.5 bg-emerald-500"
                                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                />
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab('appearance')}
                            className={`relative text-xl font-light tracking-wide transition-colors ${activeTab === 'appearance' ? (theme === 'light' ? 'text-zinc-900' : 'text-zinc-100') : (theme === 'light' ? 'text-zinc-400 hover:text-zinc-600' : 'text-zinc-500 hover:text-zinc-300')}`}
                        >
                            Appearance
                            {activeTab === 'appearance' && (
                                <motion.div
                                    layoutId="activeTab"
                                    className="absolute -bottom-1 left-0 right-0 h-0.5 bg-emerald-500"
                                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                />
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab('knowledge')}
                            className={`relative text-xl font-light tracking-wide transition-colors ${activeTab === 'knowledge' ? (theme === 'light' ? 'text-zinc-900' : 'text-zinc-100') : (theme === 'light' ? 'text-zinc-400 hover:text-zinc-600' : 'text-zinc-500 hover:text-zinc-300')}`}
                        >
                            Knowledge Base
                            {activeTab === 'knowledge' && (
                                <motion.div
                                    layoutId="activeTab"
                                    className="absolute -bottom-1 left-0 right-0 h-0.5 bg-emerald-500"
                                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                />
                            )}
                        </button>
                    </div>

                    <button
                        onClick={onClose}
                        className={`${theme === 'light' ? 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100' : 'text-zinc-400 hover:text-white hover:bg-white/5'} transition-colors p-2 rounded-full`}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="overflow-y-auto flex-1 sleek-scrollbar">

                    <div className="p-6">
                        {activeTab === 'settings' && (
                            <div className="space-y-8">
                                {/* Avatar Settings */}
                                <div>
                                    <h3 className="text-sm font-medium text-emerald-500 uppercase tracking-wider mb-4">Avatar Configuration</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className={`block text-xs font-light ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'} mb-1.5 uppercase tracking-wide`}>Character</label>
                                            <div className="relative">
                                                <select
                                                    value={avatarConfig.character}
                                                    onChange={(e) => setAvatarConfig({ ...avatarConfig, character: e.target.value })}
                                                    disabled={isConnected}
                                                    className={`w-full px-4 py-2.5 pr-10 appearance-none ${theme === 'light' ? 'bg-zinc-50 border-zinc-300 text-zinc-900' : 'bg-zinc-950 border-zinc-800 text-zinc-200'} border rounded-lg focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500/50 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed font-light`}
                                                >
                                                    <option value="Meg">Meg</option>
                                                    <option value="Harry">Harry</option>
                                                    <option value="Lisa">Lisa</option>
                                                    <option value="Jeff">Jeff</option>
                                                </select>
                                                <div className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                </div>
                                            </div>
                                        </div>
                                        <div>
                                            <label className={`block text-xs font-light ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'} mb-1.5 uppercase tracking-wide`}>Style</label>
                                            <input
                                                type="text"
                                                value={avatarConfig.style}
                                                onChange={(e) => setAvatarConfig({ ...avatarConfig, style: e.target.value })}
                                                disabled={isConnected}
                                                className={`w-full px-4 py-2.5 ${theme === 'light' ? 'bg-zinc-50 border-zinc-300 text-zinc-900' : 'bg-zinc-950 border-zinc-800 text-zinc-200'} border rounded-lg focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500/50 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed ${theme === 'light' ? 'placeholder-zinc-400' : 'placeholder-zinc-700'} font-light`}
                                            />
                                        </div>
                                        <div>
                                            <label className={`block text-xs font-light ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'} mb-1.5 uppercase tracking-wide`}>App Title</label>
                                            <input
                                                type="text"
                                                value={appTitle}
                                                onChange={(e) => setAppTitle(e.target.value)}
                                                className={`w-full px-4 py-2.5 ${theme === 'light' ? 'bg-zinc-50 border-zinc-300 text-zinc-900' : 'bg-zinc-950 border-zinc-800 text-zinc-200'} border rounded-lg focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500/50 outline-none transition-all ${theme === 'light' ? 'placeholder-zinc-400' : 'placeholder-zinc-700'} font-light`}
                                            />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className={`block text-xs font-light ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'} mb-1.5 uppercase tracking-wide`}>App Description</label>
                                            <input
                                                type="text"
                                                value={appDescription}
                                                onChange={(e) => setAppDescription(e.target.value)}
                                                placeholder="Enter a description for your assistant..."
                                                className={`w-full px-4 py-2.5 ${theme === 'light' ? 'bg-zinc-50 border-zinc-300 text-zinc-900' : 'bg-zinc-950 border-zinc-800 text-zinc-200'} border rounded-lg focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500/50 outline-none transition-all ${theme === 'light' ? 'placeholder-zinc-400' : 'placeholder-zinc-700'} font-light`}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Azure Speech */}
                                <div>
                                    <h3 className="text-sm font-medium text-emerald-500 uppercase tracking-wider mb-4">Azure Speech</h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className={`block text-xs font-light ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'} mb-1.5 uppercase tracking-wide`}>Region</label>
                                            <div className="relative">
                                                <select
                                                    value={speechConfig.region}
                                                    onChange={(e) => setSpeechConfig({ ...speechConfig, region: e.target.value })}
                                                    disabled={isConnected}
                                                    className={`w-full px-4 py-2.5 pr-10 appearance-none ${theme === 'light' ? 'bg-zinc-50 border-zinc-300 text-zinc-900' : 'bg-zinc-950 border-zinc-800 text-zinc-200'} border rounded-lg focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500/50 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed font-light`}
                                                >
                                                    <option value="westeurope">West Europe</option>
                                                    <option value="eastus2">East US 2</option>
                                                    <option value="westus2">West US 2</option>
                                                </select>
                                                <div className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                </div>
                                            </div>
                                        </div>
                                        <div>
                                            <label className={`block text-xs font-light ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'} mb-1.5 uppercase tracking-wide`}>API Key</label>
                                            <div className="relative">
                                                <input
                                                    type={showSpeechApiKey ? "text" : "password"}
                                                    value={speechConfig.apiKey}
                                                    onChange={(e) => setSpeechConfig({ ...speechConfig, apiKey: e.target.value })}
                                                    disabled={isConnected}
                                                    className={`w-full px-4 py-2.5 pr-10 ${theme === 'light' ? 'bg-zinc-50 border-zinc-300 text-zinc-900' : 'bg-zinc-950 border-zinc-800 text-zinc-200'} border rounded-lg focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500/50 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed ${theme === 'light' ? 'placeholder-zinc-400' : 'placeholder-zinc-700'} font-light`}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowSpeechApiKey(!showSpeechApiKey)}
                                                    className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 ${theme === 'light' ? 'text-zinc-500 hover:text-zinc-700' : 'text-zinc-500 hover:text-zinc-300'} transition-colors`}
                                                >
                                                    {showSpeechApiKey ? (
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                                        </svg>
                                                    ) : (
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                        </svg>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Text to Speech */}
                                <div>
                                    <h3 className="text-sm font-medium text-emerald-500 uppercase tracking-wider mb-4">Text to Speech</h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className={`block text-xs font-light ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'} mb-1.5 uppercase tracking-wide`}>Voice Name</label>
                                            <input
                                                type="text"
                                                value={ttsConfig.voice}
                                                onChange={(e) => setTTSConfig({ ...ttsConfig, voice: e.target.value })}
                                                disabled={isConnected}
                                                placeholder="en-US-AvaMultilingualNeural"
                                                className={`w-full px-4 py-2.5 ${theme === 'light' ? 'bg-zinc-50 border-zinc-300 text-zinc-900' : 'bg-zinc-950 border-zinc-800 text-zinc-200'} border rounded-lg focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500/50 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed ${theme === 'light' ? 'placeholder-zinc-400' : 'placeholder-zinc-700'} font-light`}
                                            />
                                            <p className={`text-[10px] mt-1 ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-500'}`}>
                                                e.g. en-US-AvaMultilingualNeural, en-US-AndrewMultilingualNeural
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Azure OpenAI */}
                                <div>
                                    <h3 className="text-sm font-medium text-emerald-500 uppercase tracking-wider mb-4">Azure OpenAI</h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className={`block text-xs font-light ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'} mb-1.5 uppercase tracking-wide`}>Endpoint</label>
                                            <input
                                                type="text"
                                                value={openAIConfig.endpoint}
                                                onChange={(e) => setOpenAIConfig({ ...openAIConfig, endpoint: e.target.value })}
                                                disabled={isConnected}
                                                placeholder="https://your-resource.openai.azure.com/"
                                                className={`w-full px-4 py-2.5 ${theme === 'light' ? 'bg-zinc-50 border-zinc-300 text-zinc-900' : 'bg-zinc-950 border-zinc-800 text-zinc-200'} border rounded-lg focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500/50 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed ${theme === 'light' ? 'placeholder-zinc-400' : 'placeholder-zinc-700'} font-light`}
                                            />
                                        </div>
                                        <div>
                                            <label className={`block text-xs font-light ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'} mb-1.5 uppercase tracking-wide`}>API Key</label>
                                            <div className="relative">
                                                <input
                                                    type={showOpenAIApiKey ? "text" : "password"}
                                                    value={openAIConfig.apiKey}
                                                    onChange={(e) => setOpenAIConfig({ ...openAIConfig, apiKey: e.target.value })}
                                                    disabled={isConnected}
                                                    className={`w-full px-4 py-2.5 pr-10 ${theme === 'light' ? 'bg-zinc-50 border-zinc-300 text-zinc-900' : 'bg-zinc-950 border-zinc-800 text-zinc-200'} border rounded-lg focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500/50 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed ${theme === 'light' ? 'placeholder-zinc-400' : 'placeholder-zinc-700'} font-light`}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowOpenAIApiKey(!showOpenAIApiKey)}
                                                    className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 ${theme === 'light' ? 'text-zinc-500 hover:text-zinc-700' : 'text-zinc-500 hover:text-zinc-300'} transition-colors`}
                                                >
                                                    {showOpenAIApiKey ? (
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                                        </svg>
                                                    ) : (
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                        </svg>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                        <div>
                                            <label className={`block text-xs font-light ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'} mb-1.5 uppercase tracking-wide`}>Deployment</label>
                                            <input
                                                type="text"
                                                value={openAIConfig.deploymentName}
                                                onChange={(e) => setOpenAIConfig({ ...openAIConfig, deploymentName: e.target.value })}
                                                disabled={isConnected}
                                                placeholder="gpt-4o-mini"
                                                className={`w-full px-4 py-2.5 ${theme === 'light' ? 'bg-zinc-50 border-zinc-300 text-zinc-900' : 'bg-zinc-950 border-zinc-800 text-zinc-200'} border rounded-lg focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500/50 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed ${theme === 'light' ? 'placeholder-zinc-400' : 'placeholder-zinc-700'} font-light`}
                                            />
                                        </div>
                                        <div>
                                            <label className={`block text-xs font-light ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'} mb-1.5 uppercase tracking-wide`}>System Prompt</label>
                                            <div className={`group rounded-lg overflow-hidden border ${theme === 'light' ? 'border-zinc-300 bg-zinc-50 focus-within:ring-1 focus-within:ring-emerald-500 focus-within:border-emerald-500/50' : 'border-zinc-800 bg-zinc-950 focus-within:ring-1 focus-within:ring-emerald-500 focus-within:border-emerald-500/50'} transition-all`}>
                                                <textarea
                                                    value={openAIConfig.systemPrompt}
                                                    onChange={(e) => setOpenAIConfig({ ...openAIConfig, systemPrompt: e.target.value })}
                                                    rows={10}
                                                    className={`w-full block px-4 py-2.5 bg-transparent border-0 focus:ring-0 outline-none transition-all font-mono text-xs leading-relaxed resize-y sleek-scrollbar ${theme === 'light' ? 'text-zinc-800 placeholder-zinc-400' : 'text-zinc-300 placeholder-zinc-700'}`}
                                                    placeholder="You are a helpful assistant..."
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'appearance' && (
                            <div className="space-y-6">
                                {/* Company Icon */}
                                <div>
                                    <h3 className="text-sm font-medium text-emerald-500 uppercase tracking-wider mb-4">Company Branding</h3>
                                    <div className={`p-4 rounded-xl border ${theme === 'light' ? 'bg-white border-zinc-200' : 'bg-zinc-900/50 border-zinc-800'}`}>
                                        <div className="flex items-start gap-4">
                                            <div className={`relative w-20 h-20 ${theme === 'light' ? 'bg-zinc-100 border-zinc-300' : 'bg-zinc-900 border-zinc-800'} rounded-lg border flex items-center justify-center overflow-hidden shrink-0`}>
                                                <Image
                                                    src={logoUrl}
                                                    alt="Icon Preview"
                                                    fill
                                                    className="object-contain p-2"
                                                />
                                            </div>
                                            <div
                                                className="flex-1 outline-none"
                                                tabIndex={0}
                                                onPaste={(e) => {
                                                    const items = e.clipboardData.items;
                                                    for (let i = 0; i < items.length; i++) {
                                                        if (items[i].type.indexOf('image') !== -1) {
                                                            const blob = items[i].getAsFile();
                                                            if (blob) {
                                                                const reader = new FileReader();
                                                                reader.onload = (event) => {
                                                                    if (event.target?.result) {
                                                                        setLogoUrl(event.target.result as string);
                                                                    }
                                                                };
                                                                reader.readAsDataURL(blob);
                                                            }
                                                            break;
                                                        }
                                                    }
                                                }}
                                            >
                                                <label className={`block text-xs font-light ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'} mb-2 uppercase tracking-wide`}>Company Icon</label>
                                                <div className="flex items-center gap-3 mb-2">
                                                    <label className="cursor-pointer bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium py-2 px-4 rounded-full transition-colors shrink-0">
                                                        Choose File
                                                        <input
                                                            type="file"
                                                            accept="image/*"
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
                                                                            // data.url is likely the full API url or relative. 
                                                                            // The backend allows us to construct it: /api/profiles/[id]/assets?file=[filename]
                                                                            // But looking at background upload, it might return { url: ... }
                                                                            // Let's assume it returns { url: ... } based on background logic.
                                                                            if (data.url) {
                                                                                setLogoUrl(data.url);
                                                                            }
                                                                        }
                                                                    } catch (err) {
                                                                        console.error("Failed to upload logo", err);
                                                                    }
                                                                }
                                                            }}
                                                            className="hidden"
                                                        />
                                                    </label>
                                                    <span className={`text-xs ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>
                                                        Upload or click area to paste
                                                    </span>
                                                </div>

                                                {/* Logo Paste Logic Refactored inline */}
                                                {/* Note: The setLogoUrl in parent component should ideally be using the new API upload too.
                                                    But 'setLogoUrl' passed here is likely just state setter.
                                                    We need to intercept the image and upload it to profiles/.../assets
                                                    then set the logoUrl to the new asset path.
                                                    
                                                    But to keep changes minimal, we assume setLogoUrl handles the string.
                                                    Real implementation of uploading logo:
                                                */}
                                            </div>
                                        </div>
                                    </div>
                                </div>


                                {/* Avatar Background */}
                                <div>
                                    <h3 className="text-sm font-medium text-emerald-500 uppercase tracking-wider mb-4">Background</h3>
                                    <div className={`p-4 rounded-xl border ${theme === 'light' ? 'bg-white border-zinc-200' : 'bg-zinc-900/50 border-zinc-800'}`}>
                                        <div className="flex items-start gap-4">
                                            <div className={`relative w-40 h-24 ${theme === 'light' ? 'bg-zinc-100 border-zinc-300' : 'bg-zinc-900 border-zinc-800'} rounded-lg border overflow-hidden shrink-0`}>
                                                <AvatarBackground theme={theme} src={backgroundUrl} />
                                            </div>
                                            <div
                                                className="flex-1 outline-none"
                                                tabIndex={0}
                                                // Background paste handling implementation is needed if generic paste is supported, 
                                                // but current requirement was mainly for decoupling. 
                                                // We can implement paste for background too if user wants complete consistency.
                                                // Let's add basic paste handler.
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
                                            >
                                                <label className={`block text-xs font-light ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'} mb-2 uppercase tracking-wide`}>Avatar Background</label>
                                                <div className="flex items-center gap-3 mb-2">
                                                    <label className="cursor-pointer bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium py-2 px-4 rounded-full transition-colors shrink-0">
                                                        Choose File
                                                        <input
                                                            type="file"
                                                            accept="image/*,video/*"
                                                            onChange={handleBgUpload}
                                                            className="hidden"
                                                        />
                                                    </label>
                                                    <span className={`text-xs truncate ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>
                                                        {bgFilename || 'No file chosen'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <p className={`text-xs ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>
                                                        Click here to <span className="text-emerald-500 font-medium">focus & paste</span> (Ctrl+V)
                                                    </p>
                                                    {bgFilename && (
                                                        <button
                                                            onClick={async () => {
                                                                if (!confirm('Remove custom background?')) return;
                                                                setBackgroundUrl(null);
                                                            }}
                                                            className="text-xs text-red-500 hover:text-red-600 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors"
                                                        >
                                                            Remove
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'knowledge' && (
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-sm font-medium text-emerald-500 uppercase tracking-wider mb-4">Upload Files</h3>
                                    <div className={`relative p-8 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-center transition-all ${theme === 'light' ? 'border-zinc-300 bg-zinc-50 hover:bg-zinc-100 hover:border-emerald-500' : 'border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 hover:border-emerald-500'}`}>
                                        <input
                                            type="file"
                                            onChange={handleFileUpload}
                                            disabled={isUploading}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        />
                                        <div className={`p-3 rounded-full mb-3 ${theme === 'light' ? 'bg-zinc-100 text-zinc-500' : 'bg-zinc-800 text-zinc-400'}`}>
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                            </svg>
                                        </div>
                                        <p className={`text-sm font-medium ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>
                                            {isUploading ? 'Uploading...' : 'Click or drag file to upload'}
                                        </p>
                                        <p className={`text-xs mt-1 ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>
                                            Supported: .txt, .json, .md, .csv
                                        </p>
                                    </div>
                                    {uploadError && (
                                        <p className="text-sm text-red-500 text-center">{uploadError}</p>
                                    )}
                                </div>

                                <div>
                                    <h3 className="text-sm font-medium text-emerald-500 uppercase tracking-wider mb-4">Knowledge Files</h3>
                                    {knowledgeFiles.length === 0 ? (
                                        <div className={`text-center py-8 ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-500'}`}>
                                            <p className="text-sm">No files uploaded yet</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {knowledgeFiles.map((file) => (
                                                <div key={file} className={`flex items-center justify-between p-3 rounded-lg border ${theme === 'light' ? 'bg-white border-zinc-200' : 'bg-zinc-900/50 border-zinc-800'}`}>
                                                    <div className="flex items-center gap-3 overflow-hidden">
                                                        <svg className={`w-5 h-5 flex-shrink-0 ${theme === 'light' ? 'text-zinc-400' : 'text-zinc-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                        </svg>
                                                        <span className={`text-sm truncate ${theme === 'light' ? 'text-zinc-700' : 'text-zinc-300'}`}>{file}</span>
                                                    </div>
                                                    <button
                                                        onClick={() => handleDeleteFile(file)}
                                                        className="text-zinc-400 hover:text-red-500 transition-colors p-1"
                                                        title="Delete file"
                                                    >
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className={`p-6 border-t ${theme === 'light' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900/50 border-zinc-800'}`}>
                    <button
                        onClick={async () => {
                            await onSavePromise();
                            onClose();
                        }}
                        className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg transition-colors shadow-lg shadow-emerald-500/20"
                    >
                        Save Settings
                    </button>
                </div>
            </div>
        </div >

    );
};

export default SettingsPanel;
