import type { AvatarConfig } from '@/types/avatar';

const PREVIEW_BASE = 'https://learn.microsoft.com/en-us/azure/ai-services/speech-service/text-to-speech-avatar/media';

export interface AvatarStyleOption {
  value: string;
  label: string;
  previewUrl: string;
}

export interface AvatarCharacterOption {
  value: string;
  label: string;
  type: 'video' | 'photo';
  previewUrl: string;
  styles: AvatarStyleOption[];
  selectable?: boolean;
  notice?: string;
}

function preview(filename: string): string {
  return `${PREVIEW_BASE}/${filename}`;
}

function photo(value: string, label: string, filename: string): AvatarCharacterOption {
  return {
    value,
    label,
    type: 'photo',
    previewUrl: preview(filename),
    styles: [],
    notice: 'Photo avatar preview. Uses the VASA-1 base model.',
  };
}

export const AZURE_AVATAR_CHARACTERS: AvatarCharacterOption[] = [
  {
    value: 'rowan',
    label: 'Rowan',
    type: 'video',
    previewUrl: preview('rowan.png'),
    styles: [],
    selectable: false,
    notice: 'Microsoft documents this avatar without a real-time style identifier.',
  },
  {
    value: 'celine',
    label: 'Celine',
    type: 'video',
    previewUrl: preview('celine.png'),
    styles: [],
    selectable: false,
    notice: 'Microsoft documents this avatar without a real-time style identifier.',
  },
  {
    value: 'nia',
    label: 'Nia',
    type: 'video',
    previewUrl: preview('nia.png'),
    styles: [],
    selectable: false,
    notice: 'Microsoft documents this avatar without a real-time style identifier.',
  },
  {
    value: 'malik',
    label: 'Malik',
    type: 'video',
    previewUrl: preview('malik.png'),
    styles: [],
    selectable: false,
    notice: 'Microsoft documents this avatar without a real-time style identifier.',
  },
  {
    value: 'harry',
    label: 'Harry',
    type: 'video',
    previewUrl: preview('harry-business.png'),
    styles: [
      { value: 'business', label: 'Business', previewUrl: preview('harry-business.png') },
      { value: 'casual', label: 'Casual', previewUrl: preview('harry-casual.png') },
      { value: 'youthful', label: 'Youthful', previewUrl: preview('harry-youthful.png') },
    ],
  },
  {
    value: 'jeff',
    label: 'Jeff',
    type: 'video',
    previewUrl: preview('jeff-business.png'),
    styles: [
      { value: 'business', label: 'Business', previewUrl: preview('jeff-business.png') },
      { value: 'formal', label: 'Formal', previewUrl: preview('jeff-formal.png') },
    ],
    notice: 'Microsoft plans to retire Jeff starting December 2026.',
  },
  {
    value: 'lisa',
    label: 'Lisa',
    type: 'video',
    previewUrl: preview('lisa-casual-sitting.png'),
    styles: [
      { value: 'casual-sitting', label: 'Casual Sitting', previewUrl: preview('lisa-casual-sitting.png') },
    ],
    notice: 'Other documented Lisa styles are batch-only and are excluded from this real-time app.',
  },
  {
    value: 'lori',
    label: 'Lori',
    type: 'video',
    previewUrl: preview('lori-casual.png'),
    styles: [
      { value: 'casual', label: 'Casual', previewUrl: preview('lori-casual.png') },
      { value: 'graceful', label: 'Graceful', previewUrl: preview('lori-graceful.png') },
      { value: 'formal', label: 'Formal', previewUrl: preview('lori-formal.png') },
    ],
  },
  {
    value: 'max',
    label: 'Max',
    type: 'video',
    previewUrl: preview('max-business.png'),
    styles: [
      { value: 'business', label: 'Business', previewUrl: preview('max-business.png') },
      { value: 'casual', label: 'Casual', previewUrl: preview('max-casual.png') },
      { value: 'formal', label: 'Formal', previewUrl: preview('max-formal.png') },
    ],
  },
  {
    value: 'meg',
    label: 'Meg',
    type: 'video',
    previewUrl: preview('meg-business.png'),
    styles: [
      { value: 'business', label: 'Business', previewUrl: preview('meg-business.png') },
      { value: 'casual', label: 'Casual', previewUrl: preview('meg-casual.png') },
      { value: 'formal', label: 'Formal', previewUrl: preview('meg-formal.png') },
    ],
  },
  photo('adrian', 'Adrian', 'adrian.png'),
  photo('amara', 'Amara', 'amara.png'),
  photo('amira', 'Amira', 'amira-avatar.png'),
  photo('anika', 'Anika', 'anika-avatar.png'),
  photo('bianca', 'Bianca', 'bianca.png'),
  photo('camila', 'Camila', 'camila.png'),
  photo('carlos', 'Carlos', 'carlos.png'),
  photo('clara', 'Clara', 'clara.png'),
  photo('darius', 'Darius', 'darius.png'),
  photo('diego', 'Diego', 'diego.png'),
  photo('elise', 'Elise', 'elise.png'),
  photo('farhan', 'Farhan', 'farhan-avatar.png'),
  photo('faris', 'Faris', 'faris-avatar.png'),
  photo('gabrielle', 'Gabrielle', 'gabrielle.png'),
  photo('hyejin', 'Hyejin', 'hyejin-avatar.png'),
  photo('imran', 'Imran', 'imran-avatar.png'),
  photo('isabella', 'Isabella', 'isabella.png'),
  photo('layla', 'Layla', 'layla.png'),
  photo('liwei', 'Liwei', 'liwei-avatar.png'),
  photo('ling', 'Ling', 'ling.png'),
  photo('marcus', 'Marcus', 'marcus.png'),
  photo('matteo', 'Matteo', 'matteo.png'),
  photo('rahul', 'Rahul', 'rahul-avatar.png'),
  photo('rana', 'Rana', 'rana.png'),
  photo('ren', 'Ren', 'ren-avatar.png'),
  photo('riya', 'Riya', 'riya-avatar.png'),
  photo('sakura', 'Sakura', 'sakura-avatar.png'),
  photo('simone', 'Simone', 'simone.png'),
  photo('zayd', 'Zayd', 'zayd-avatar.png'),
  photo('zoe', 'Zoe', 'zoe.png'),
];

export function findAvatarCharacter(character: string | undefined): AvatarCharacterOption | undefined {
  const normalized = character?.trim().toLowerCase();
  return AZURE_AVATAR_CHARACTERS.find((option) => option.value === normalized);
}

export function getAvatarPreview(character: AvatarCharacterOption, style: string): string {
  return character.styles.find((option) => option.value === style)?.previewUrl || character.previewUrl;
}

export function normalizeAvatarConfig(config: AvatarConfig): AvatarConfig {
  if (config.customized) return config;

  const character = findAvatarCharacter(config.character);
  const fallback = AZURE_AVATAR_CHARACTERS.find((option) => option.value === 'harry')!;
  const selected = character?.selectable === false ? fallback : (character || fallback);

  if (selected.type === 'photo') {
    return {
      ...config,
      character: selected.value,
      style: '',
      avatarType: 'photo',
      photoAvatarBaseModel: 'vasa-1',
      videoCrop: false,
    };
  }

  const style = selected.styles.some((option) => option.value === config.style)
    ? config.style
    : selected.styles[0].value;
  return {
    ...config,
    character: selected.value,
    style,
    avatarType: 'video',
    photoAvatarBaseModel: undefined,
  };
}
