
import React, { Dispatch, SetStateAction, useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import type { AvatarConfig, SpeechConfig, AzureOpenAIConfig } from '@/types/avatar';

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

    // App Settings
    appTitle: string;
    setAppTitle: Dispatch<SetStateAction<string>>;
    appDescription: string;
    setAppDescription: Dispatch<SetStateAction<string>>;
    logoUrl: string;
    setLogoUrl: Dispatch<SetStateAction<string>>;

    // Visibility States
    showSpeechApiKey: boolean;
    setShowSpeechApiKey: Dispatch<SetStateAction<boolean>>;
    showOpenAIApiKey: boolean;
    setShowOpenAIApiKey: Dispatch<SetStateAction<boolean>>;

    onStartSession: () => void;
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
    appTitle,
    setAppTitle,
    appDescription,
    setAppDescription,
    logoUrl,
    setLogoUrl,
    showSpeechApiKey,
    setShowSpeechApiKey,
    showOpenAIApiKey,
    setShowOpenAIApiKey,
    onStartSession
}: Props) => {
    // Tab state
    const [activeTab, setActiveTab] = useState<'settings' | 'knowledge'>('settings');
    const [knowledgeFiles, setKnowledgeFiles] = useState<string[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);

    // Fetch knowledge files on open or tab switch
    useEffect(() => {
        if (isOpen && activeTab === 'knowledge') {
            fetchKnowledgeFiles();
        }
    }, [isOpen, activeTab]);

    const fetchKnowledgeFiles = async () => {
        try {
            const res = await fetch('/api/knowledge');
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

        setIsUploading(true);
        setUploadError(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/knowledge', {
                method: 'POST',
                body: formData
            });

            if (!res.ok) throw new Error('Upload failed');

            await fetchKnowledgeFiles();
            // Clear input
            e.target.value = '';
        } catch (err) {
            setUploadError('Failed to upload file');
        } finally {
            setIsUploading(false);
        }
    };

    const handleDeleteFile = async (filename: string) => {
        if (!confirm(`Delete ${filename}?`)) return;

        try {
            await fetch('/api/knowledge?filename=' + encodeURIComponent(filename), {
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
            <div className={`${theme === 'light' ? 'bg-white border-zinc-300' : 'bg-zinc-900 border-zinc-800'} border rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] ring-1 ${theme === 'light' ? 'ring-zinc-200' : 'ring-white/10'} overflow-hidden flex flex-col`}>
                <div className={`sticky top-0 ${theme === 'light' ? 'bg-white/95' : 'bg-zinc-900/95'} backdrop-blur-md border-b ${theme === 'light' ? 'border-zinc-200' : 'border-zinc-800'} px-6 py-4 flex items-center justify-between z-10`}>
                    <div className="flex gap-6">
                        <button
                            onClick={() => setActiveTab('settings')}
                            className={`text-xl font-light tracking-wide transition-colors ${activeTab === 'settings' ? (theme === 'light' ? 'text-zinc-900' : 'text-zinc-100') : (theme === 'light' ? 'text-zinc-400 hover:text-zinc-600' : 'text-zinc-500 hover:text-zinc-300')}`}
                        >
                            Settings
                        </button>
                        <button
                            onClick={() => setActiveTab('knowledge')}
                            className={`text-xl font-light tracking-wide transition-colors ${activeTab === 'knowledge' ? (theme === 'light' ? 'text-zinc-900' : 'text-zinc-100') : (theme === 'light' ? 'text-zinc-400 hover:text-zinc-600' : 'text-zinc-500 hover:text-zinc-300')}`}
                        >
                            Knowledge Base
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

                <div className="overflow-y-auto flex-1"
                    style={{
                        scrollbarWidth: 'thin',
                        scrollbarColor: theme === 'light' ? '#d4d4d8 #f4f4f5' : '#52525b #27272a'
                    }}
                >
                    <style jsx>{`
div::-webkit-scrollbar, textarea::-webkit-scrollbar {
    width: 8px;
}
div::-webkit-scrollbar-track, textarea::-webkit-scrollbar-track {
    background: ${theme === 'light' ? '#f4f4f5' : '#27272a'};
}
div::-webkit-scrollbar-thumb, textarea::-webkit-scrollbar-thumb {
    background: ${theme === 'light' ? '#d4d4d8' : '#52525b'};
    border-radius: 4px;
}
div::-webkit-scrollbar-thumb:hover, textarea::-webkit-scrollbar-thumb:hover {
    background: ${theme === 'light' ? '#a1a1aa' : '#71717a'};
}
`}</style>

                    <div className="p-6">
                        {activeTab === 'settings' && (
                            <div className="space-y-8">
                                {/* Avatar Settings */}
                                <div>
                                    <h3 className="text-sm font-medium text-emerald-500 uppercase tracking-wider mb-4">Avatar Configuration</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className={`block text-xs font-light ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'} mb-1.5 uppercase tracking-wide`}>Character</label>
                                            <input
                                                type="text"
                                                value={avatarConfig.character}
                                                onChange={(e) => setAvatarConfig({ ...avatarConfig, character: e.target.value })}
                                                disabled={isConnected}
                                                className={`w-full px-4 py-2.5 ${theme === 'light' ? 'bg-zinc-50 border-zinc-300 text-zinc-900' : 'bg-zinc-950 border-zinc-800 text-zinc-200'} border rounded-lg focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500/50 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed ${theme === 'light' ? 'placeholder-zinc-400' : 'placeholder-zinc-700'} font-light`}
                                            />
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
                                        <div className="md:col-span-2">
                                            <label className={`block text-xs font-light ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'} mb-1.5 uppercase tracking-wide`}>App Icon</label>
                                            <div
                                                className={`flex items-center gap-4 p-4 ${theme === 'light' ? 'bg-zinc-50 border-zinc-300' : 'bg-zinc-950 border-zinc-800'} border rounded-lg outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500/50 transition-all cursor-pointer group`}
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
                                                <div className={`relative w-16 h-16 ${theme === 'light' ? 'bg-zinc-100 border-zinc-300' : 'bg-zinc-900 border-zinc-800'} rounded-lg border flex items-center justify-center overflow-hidden shrink-0`}>
                                                    <Image
                                                        src={logoUrl}
                                                        alt="Icon Preview"
                                                        fill
                                                        className="object-contain p-2"
                                                        onError={() => setLogoUrl('/logo.png')}
                                                    />
                                                </div>
                                                <div className="flex-1">
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0];
                                                            if (file) {
                                                                const reader = new FileReader();
                                                                reader.onload = (e) => {
                                                                    if (e.target?.result) {
                                                                        setLogoUrl(e.target.result as string);
                                                                    }
                                                                };
                                                                reader.readAsDataURL(file);
                                                            }
                                                        }}
                                                        className="w-full text-sm text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-medium file:bg-emerald-500 file:text-white hover:file:bg-emerald-600 cursor-pointer"
                                                    />
                                                    <p className={`mt-2 text-xs ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>
                                                        Upload an image or <span className="text-emerald-500 font-medium">paste from clipboard</span> (Ctrl+V)
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Azure Speech */}
                                <div>
                                    <h3 className="text-sm font-medium text-emerald-500 uppercase tracking-wider mb-4">Azure Speech</h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className={`block text-xs font-light ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'} mb-1.5 uppercase tracking-wide`}>Region</label>
                                            <select
                                                value={speechConfig.region}
                                                onChange={(e) => setSpeechConfig({ ...speechConfig, region: e.target.value })}
                                                disabled={isConnected}
                                                className={`w-full px-4 py-2.5 ${theme === 'light' ? 'bg-zinc-50 border-zinc-300 text-zinc-900' : 'bg-zinc-950 border-zinc-800 text-zinc-200'} border rounded-lg focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500/50 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed font-light`}
                                            >
                                                <option value="westeurope">West Europe</option>
                                                <option value="eastus2">East US 2</option>
                                                <option value="westus2">West US 2</option>
                                            </select>
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
                                                    className={`w-full block px-4 py-2.5 bg-transparent border-0 focus:ring-0 outline-none transition-all font-mono text-xs leading-relaxed resize-y ${theme === 'light' ? 'text-zinc-800 placeholder-zinc-400' : 'text-zinc-300 placeholder-zinc-700'}`}
                                                    style={{
                                                        scrollbarWidth: 'thin',
                                                        scrollbarColor: theme === 'light' ? '#d4d4d8 #f4f4f5' : '#52525b #27272a'
                                                    }}
                                                    placeholder="You are a helpful assistant..."
                                                />
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
                        onClick={onClose}
                        className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg transition-colors shadow-lg shadow-emerald-500/20"
                    >
                        Save Settings
                    </button>
                </div>
            </div>
        </div>

    );
};

export default SettingsPanel;
