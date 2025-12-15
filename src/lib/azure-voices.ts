/**
 * Azure Speech Service TTS Voices
 * 
 * English and Arabic voices from Azure Speech Service
 * Source: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts
 */

export interface VoiceOption {
  value: string;
  label: string;
  locale: string;
  gender: 'Male' | 'Female' | 'Neutral';
}

/**
 * English voices (en-US, en-GB, en-AU, etc.)
 */
export const ENGLISH_VOICES: VoiceOption[] = [
  // English (United States)
  { value: 'en-US-AvaMultilingualNeural', label: 'Ava (Multilingual, Female)', locale: 'en-US', gender: 'Female' },
  { value: 'en-US-AndrewMultilingualNeural', label: 'Andrew (Multilingual, Male)', locale: 'en-US', gender: 'Male' },
  { value: 'en-US-EmmaMultilingualNeural', label: 'Emma (Multilingual, Female)', locale: 'en-US', gender: 'Female' },
  { value: 'en-US-BrianMultilingualNeural', label: 'Brian (Multilingual, Male)', locale: 'en-US', gender: 'Male' },
  { value: 'en-US-JennyNeural', label: 'Jenny (Female)', locale: 'en-US', gender: 'Female' },
  { value: 'en-US-GuyNeural', label: 'Guy (Male)', locale: 'en-US', gender: 'Male' },
  { value: 'en-US-AriaNeural', label: 'Aria (Female)', locale: 'en-US', gender: 'Female' },
  { value: 'en-US-DavisNeural', label: 'Davis (Male)', locale: 'en-US', gender: 'Male' },
  { value: 'en-US-JaneNeural', label: 'Jane (Female)', locale: 'en-US', gender: 'Female' },
  { value: 'en-US-JasonNeural', label: 'Jason (Male)', locale: 'en-US', gender: 'Male' },
  { value: 'en-US-NancyNeural', label: 'Nancy (Female)', locale: 'en-US', gender: 'Female' },
  { value: 'en-US-TonyNeural', label: 'Tony (Male)', locale: 'en-US', gender: 'Male' },
  { value: 'en-US-SaraNeural', label: 'Sara (Female)', locale: 'en-US', gender: 'Female' },
  { value: 'en-US-MichelleNeural', label: 'Michelle (Female)', locale: 'en-US', gender: 'Female' },
  { value: 'en-US-RogerNeural', label: 'Roger (Male)', locale: 'en-US', gender: 'Male' },
  
  // English (United Kingdom)
  { value: 'en-GB-SoniaNeural', label: 'Sonia (Female, UK)', locale: 'en-GB', gender: 'Female' },
  { value: 'en-GB-RyanNeural', label: 'Ryan (Male, UK)', locale: 'en-GB', gender: 'Male' },
  { value: 'en-GB-LibbyNeural', label: 'Libby (Female, UK)', locale: 'en-GB', gender: 'Female' },
  { value: 'en-GB-MaisieNeural', label: 'Maisie (Female, UK)', locale: 'en-GB', gender: 'Female' },
  { value: 'en-GB-ThomasNeural', label: 'Thomas (Male, UK)', locale: 'en-GB', gender: 'Male' },
  
  // English (Australia)
  { value: 'en-AU-NatashaNeural', label: 'Natasha (Female, AU)', locale: 'en-AU', gender: 'Female' },
  { value: 'en-AU-WilliamNeural', label: 'William (Male, AU)', locale: 'en-AU', gender: 'Male' },
  
  // English (Canada)
  { value: 'en-CA-ClaraNeural', label: 'Clara (Female, CA)', locale: 'en-CA', gender: 'Female' },
  { value: 'en-CA-LiamNeural', label: 'Liam (Male, CA)', locale: 'en-CA', gender: 'Male' },
  
  // English (India)
  { value: 'en-IN-NeerjaNeural', label: 'Neerja (Female, IN)', locale: 'en-IN', gender: 'Female' },
  { value: 'en-IN-PrabhatNeural', label: 'Prabhat (Male, IN)', locale: 'en-IN', gender: 'Male' },
  
  // English (Ireland)
  { value: 'en-IE-EmilyNeural', label: 'Emily (Female, IE)', locale: 'en-IE', gender: 'Female' },
  { value: 'en-IE-ConnorNeural', label: 'Connor (Male, IE)', locale: 'en-IE', gender: 'Male' },
  
  // English (New Zealand)
  { value: 'en-NZ-MollyNeural', label: 'Molly (Female, NZ)', locale: 'en-NZ', gender: 'Female' },
  { value: 'en-NZ-MitchellNeural', label: 'Mitchell (Male, NZ)', locale: 'en-NZ', gender: 'Male' },
  
  // English (South Africa)
  { value: 'en-ZA-LeahNeural', label: 'Leah (Female, ZA)', locale: 'en-ZA', gender: 'Female' },
  { value: 'en-ZA-LukeNeural', label: 'Luke (Male, ZA)', locale: 'en-ZA', gender: 'Male' },
];

/**
 * Arabic voices (ar-SA, ar-EG, ar-AE, etc.)
 */
export const ARABIC_VOICES: VoiceOption[] = [
  // Arabic (Saudi Arabia)
  { value: 'ar-SA-ZariyahNeural', label: 'Zariyah (Female, SA)', locale: 'ar-SA', gender: 'Female' },
  { value: 'ar-SA-HamedNeural', label: 'Hamed (Male, SA)', locale: 'ar-SA', gender: 'Male' },
  
  // Arabic (Egypt)
  { value: 'ar-EG-SalmaNeural', label: 'Salma (Female, EG)', locale: 'ar-EG', gender: 'Female' },
  { value: 'ar-EG-ShakirNeural', label: 'Shakir (Male, EG)', locale: 'ar-EG', gender: 'Male' },
  
  // Arabic (United Arab Emirates)
  { value: 'ar-AE-FatimaNeural', label: 'Fatima (Female, AE)', locale: 'ar-AE', gender: 'Female' },
  { value: 'ar-AE-HamdanNeural', label: 'Hamdan (Male, AE)', locale: 'ar-AE', gender: 'Male' },
  
  // Arabic (Iraq)
  { value: 'ar-IQ-RanaNeural', label: 'Rana (Female, IQ)', locale: 'ar-IQ', gender: 'Female' },
  { value: 'ar-IQ-BasselNeural', label: 'Bassel (Male, IQ)', locale: 'ar-IQ', gender: 'Male' },
  
  // Arabic (Jordan)
  { value: 'ar-JO-SanaNeural', label: 'Sana (Female, JO)', locale: 'ar-JO', gender: 'Female' },
  { value: 'ar-JO-TaimNeural', label: 'Taim (Male, JO)', locale: 'ar-JO', gender: 'Male' },
  
  // Arabic (Kuwait)
  { value: 'ar-KW-NouraNeural', label: 'Noura (Female, KW)', locale: 'ar-KW', gender: 'Female' },
  { value: 'ar-KW-FahedNeural', label: 'Fahed (Male, KW)', locale: 'ar-KW', gender: 'Male' },
  
  // Arabic (Lebanon)
  { value: 'ar-LB-LaylaNeural', label: 'Layla (Female, LB)', locale: 'ar-LB', gender: 'Female' },
  { value: 'ar-LB-RamiNeural', label: 'Rami (Male, LB)', locale: 'ar-LB', gender: 'Male' },
  
  // Arabic (Morocco)
  { value: 'ar-MA-MounaNeural', label: 'Mouna (Female, MA)', locale: 'ar-MA', gender: 'Female' },
  { value: 'ar-MA-JamalNeural', label: 'Jamal (Male, MA)', locale: 'ar-MA', gender: 'Male' },
  
  // Arabic (Qatar)
  { value: 'ar-QA-AmalNeural', label: 'Amal (Female, QA)', locale: 'ar-QA', gender: 'Female' },
  { value: 'ar-QA-MoazNeural', label: 'Moaz (Male, QA)', locale: 'ar-QA', gender: 'Male' },
  
  // Arabic (Tunisia)
  { value: 'ar-TN-ReemNeural', label: 'Reem (Female, TN)', locale: 'ar-TN', gender: 'Female' },
  { value: 'ar-TN-HediNeural', label: 'Hedi (Male, TN)', locale: 'ar-TN', gender: 'Male' },
  
  // Arabic (Yemen)
  { value: 'ar-YE-MaryamNeural', label: 'Maryam (Female, YE)', locale: 'ar-YE', gender: 'Female' },
  { value: 'ar-YE-SalehNeural', label: 'Saleh (Male, YE)', locale: 'ar-YE', gender: 'Male' },
];

/**
 * All available voices (English + Arabic)
 */
export const ALL_VOICES: VoiceOption[] = [
  ...ENGLISH_VOICES,
  ...ARABIC_VOICES,
];

/**
 * Get voices grouped by language
 */
export function getVoicesByLanguage(): { language: string; voices: VoiceOption[] }[] {
  return [
    { language: 'English', voices: ENGLISH_VOICES },
    { language: 'Arabic', voices: ARABIC_VOICES },
  ];
}

