import fs from 'fs/promises';
import path from 'path';
import { AvatarProfile } from '@/types/profile';
import { getDefaultAvatarConfig, getDefaultSpeechConfig, getDefaultAzureOpenAIConfig } from './config';

const PROFILES_DIR = path.join(process.cwd(), 'data', 'profiles');

export async function ensureProfilesDir() {
    try {
        await fs.access(PROFILES_DIR);
    } catch {
        await fs.mkdir(PROFILES_DIR, { recursive: true });
        // Create default profile if fresh install
        await createProfile('Default Avatar', 'default');
    }
}

export async function getProfileDir(id: string) {
    return path.join(PROFILES_DIR, id);
}

export async function listProfiles(): Promise<AvatarProfile[]> {
    await ensureProfilesDir();
    const dirs = await fs.readdir(PROFILES_DIR);
    const profiles: AvatarProfile[] = [];

    for (const dir of dirs) {
        try {
            const configPath = path.join(PROFILES_DIR, dir, 'config.json');
            const data = await fs.readFile(configPath, 'utf-8');
            profiles.push(JSON.parse(data));
        } catch (e) {
            console.warn(`Skipping invalid profile dir: ${dir}`, e);
        }
    }

    // Sort by created
    return profiles.sort((a, b) => a.created - b.created);
}

export async function getProfile(id: string): Promise<AvatarProfile | null> {
    try {
        const configPath = path.join(PROFILES_DIR, id, 'config.json');
        const data = await fs.readFile(configPath, 'utf-8');
        return JSON.parse(data);
    } catch {
        return null;
    }
}

export async function createProfile(name: string, idOverride?: string): Promise<AvatarProfile> {
    const id = idOverride || Date.now().toString();
    const dir = path.join(PROFILES_DIR, id);

    // Create structure
    await fs.mkdir(dir, { recursive: true });
    await fs.mkdir(path.join(dir, 'assets'), { recursive: true });
    await fs.mkdir(path.join(dir, 'knowledge'), { recursive: true });

    const newProfile: AvatarProfile = {
        id,
        name,
        created: Date.now(),
        updated: Date.now(),
        avatarConfig: getDefaultAvatarConfig(),
        speechConfig: getDefaultSpeechConfig(),
        openAIConfig: getDefaultAzureOpenAIConfig(),
        logo: null,
        background: null,
        appTitle: 'Netways Avatar',
        appDescription: 'AI-powered voice assistant',
        theme: 'light'
    };

    await fs.writeFile(path.join(dir, 'config.json'), JSON.stringify(newProfile, null, 2));
    return newProfile;
}

export async function saveProfile(profile: AvatarProfile): Promise<void> {
    const dir = path.join(PROFILES_DIR, profile.id);
    profile.updated = Date.now();
    await fs.writeFile(path.join(dir, 'config.json'), JSON.stringify(profile, null, 2));
}

export async function deleteProfile(id: string): Promise<void> {
    const dir = path.join(PROFILES_DIR, id);
    await fs.rm(dir, { recursive: true, force: true });
}
