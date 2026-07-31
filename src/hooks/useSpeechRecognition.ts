'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';
import type { SpeechConfig, STTConfig } from '@/types/avatar';
import { fetchSpeechSessionCredentials } from '@/lib/webrtc';
import { getLanguageDisplay } from '@/lib/language-display';

export interface SpeechRecognitionUpdate {
  text: string;
  locale?: string;
  languageLabel?: string;
  detectionConfidence?: string;
  recognizedAt: string;
}

interface UseSpeechRecognitionProps {
  speechConfig: SpeechConfig;
  sttConfig: STTConfig;
  onRecognized?: (update: SpeechRecognitionUpdate) => void;
  onRecognizing?: (update: SpeechRecognitionUpdate) => void;
  onListeningChange?: (listening: boolean) => void;
}

function resolveDetectedLocale(
  text: string,
  detectedLocale: string | undefined,
  confidence: string | undefined,
  configuredLocales: string[],
  turnFallback: string | undefined
): string {
  const englishLocale = configuredLocales.find((locale) => locale.toLowerCase().startsWith('en')) || configuredLocales[0] || 'en-US';
  const arabicLocale = configuredLocales.find((locale) => locale.toLowerCase().startsWith('ar'));
  if (arabicLocale && /[\u0600-\u06FF]/u.test(text)) return arabicLocale;
  if (/[A-Za-z]/.test(text) && detectedLocale?.toLowerCase().startsWith('ar')) return englishLocale;
  if (confidence?.toLowerCase() === 'low') return turnFallback || englishLocale;
  return detectedLocale || turnFallback || englishLocale;
}

export function useSpeechRecognition({
  speechConfig,
  sttConfig,
  onRecognized,
  onRecognizing,
  onListeningChange,
}: UseSpeechRecognitionProps) {
  const [isListening, setIsListening] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [interimText, setInterimText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recognizerRef = useRef<SpeechSDK.SpeechRecognizer | null>(null);
  const lastDetectedLocaleRef = useRef<string | undefined>(undefined);
  const finalSegmentsRef = useRef<string[]>([]);
  const finalMetadataRef = useRef<Omit<SpeechRecognitionUpdate, 'text' | 'recognizedAt'> | null>(null);

  const flushRecognizedUtterance = useCallback(() => {
    const text = finalSegmentsRef.current.join(' ').replace(/\s+/g, ' ').trim();
    const metadata = finalMetadataRef.current;
    finalSegmentsRef.current = [];
    finalMetadataRef.current = null;
    if (!text) return;
    onRecognized?.({
      text,
      locale: metadata?.locale,
      languageLabel: metadata?.languageLabel,
      detectionConfidence: metadata?.detectionConfidence,
      recognizedAt: new Date().toISOString(),
    });
  }, [onRecognized]);

  // Cleanup recognizer
  const cleanupRecognizer = useCallback(() => {
    if (recognizerRef.current) {
      try {
        recognizerRef.current.close();
      } catch (err) {
        console.error('Error closing recognizer:', err);
      }
      recognizerRef.current = null;
    }
  }, []);

  // Initialize recognizer
  const initializeRecognizer = useCallback(async () => {
    try {
      // Cleanup any existing recognizer first
      cleanupRecognizer();

      // Create speech config
      const speechCredentials = await fetchSpeechSessionCredentials(speechConfig);
      let sdkSpeechConfig: SpeechSDK.SpeechConfig;
      if (speechConfig.enablePrivateEndpoint && speechConfig.privateEndpoint && speechCredentials.apiKey) {
        const endpoint = speechConfig.privateEndpoint.replace(/^https?:\/\//, '');
        sdkSpeechConfig = SpeechSDK.SpeechConfig.fromEndpoint(
          new URL(`wss://${endpoint}/stt/speech/universal/v2`),
          speechCredentials.apiKey
        );
      } else if (speechCredentials.authorizationToken) {
        sdkSpeechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(
          speechCredentials.authorizationToken,
          speechCredentials.region
        );
      } else {
        sdkSpeechConfig = SpeechSDK.SpeechConfig.fromEndpoint(
          new URL(`wss://${speechCredentials.region}.stt.speech.microsoft.com/speech/universal/v2`),
          speechCredentials.apiKey || ''
        );
      }

      // Apply advanced STT configurations
      if (sttConfig.profanityFilter) {
        sdkSpeechConfig.setProfanity(
          sttConfig.profanityFilter === 'masked' ? SpeechSDK.ProfanityOption.Masked :
            sttConfig.profanityFilter === 'removed' ? SpeechSDK.ProfanityOption.Removed :
              SpeechSDK.ProfanityOption.Raw
        );
      }

      if (sttConfig.enableDiarization) {
        sdkSpeechConfig.setProperty(
          SpeechSDK.PropertyId.SpeechServiceResponse_DiarizeIntermediateResults,
          'true'
        );
      }

      if (sttConfig.enableWordLevelTimestamps) {
        sdkSpeechConfig.setProperty(
          SpeechSDK.PropertyId.SpeechServiceResponse_RequestWordLevelTimestamps,
          'true'
        );
      }

      if (sttConfig.outputFormat === 'detailed') {
        sdkSpeechConfig.outputFormat = SpeechSDK.OutputFormat.Detailed;
      }

      if (sttConfig.customModelEndpointId) {
        sdkSpeechConfig.endpointId = sttConfig.customModelEndpointId;
      }

      // Setup auto-detect languages
      // Ensure locales array is valid and not empty
      const locales = Array.isArray(sttConfig.locales) && sttConfig.locales.length > 0
        ? sttConfig.locales
        : ['en-US']; // Default fallback

      // Azure DetectAudioAtStart accepts at most four candidate languages.
      // Profiles with a wider multilingual set must use Continuous LID.
      sdkSpeechConfig.setProperty(
        SpeechSDK.PropertyId.SpeechServiceConnection_LanguageIdMode,
        locales.length <= 4 ? 'AtStart' : 'Continuous'
      );
      
      const autoDetectConfig = SpeechSDK.AutoDetectSourceLanguageConfig.fromLanguages(
        locales
      );

      // Create audio config from default microphone
      const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();

      // Create recognizer
      const recognizer = SpeechSDK.SpeechRecognizer.FromConfig(
        sdkSpeechConfig,
        autoDetectConfig,
        audioConfig
      );

      recognizerRef.current = recognizer;

      // Setup event handlers
      recognizer.recognizing = (s, e) => {
        if (e.result.reason === SpeechSDK.ResultReason.RecognizingSpeech) {
          const text = e.result.text;
          const detection = SpeechSDK.AutoDetectSourceLanguageResult.fromResult(e.result);
          const locale = resolveDetectedLocale(
            text,
            detection.language,
            detection.languageDetectionConfidence,
            locales,
            lastDetectedLocaleRef.current
          );
          if (detection.languageDetectionConfidence?.toLowerCase() !== 'low') lastDetectedLocaleRef.current = locale;
          const accumulatedText = [...finalSegmentsRef.current, text].join(' ').trim();
          setInterimText(accumulatedText);
          onRecognizing?.({
            text: accumulatedText,
            locale,
            languageLabel: getLanguageDisplay(locale),
            detectionConfidence: detection.languageDetectionConfidence,
            recognizedAt: new Date().toISOString(),
          });
        }
      };

      recognizer.recognized = (s, e) => {
        if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
          const text = e.result.text.trim();
          const detection = SpeechSDK.AutoDetectSourceLanguageResult.fromResult(e.result);
          const locale = resolveDetectedLocale(
            text,
            detection.language,
            detection.languageDetectionConfidence,
            locales,
            lastDetectedLocaleRef.current
          );
          lastDetectedLocaleRef.current = locale;

          if (text) {
            finalSegmentsRef.current.push(text);
            const accumulatedText = finalSegmentsRef.current.join(' ').replace(/\s+/g, ' ').trim();
            const metadata = {
              locale,
              languageLabel: getLanguageDisplay(locale),
              detectionConfidence: detection.languageDetectionConfidence,
            };
            finalMetadataRef.current = metadata;
            setRecognizedText(accumulatedText);
            setInterimText(accumulatedText);
            onRecognizing?.({
              text: accumulatedText,
              ...metadata,
              recognizedAt: new Date().toISOString(),
            });
          }
        }
      };

      recognizer.canceled = (s, e) => {
        console.error('Speech recognition canceled:', e.errorDetails);
        setError(e.errorDetails);
        setIsListening(false);
        onListeningChange?.(false);
        setIsStarting(false);
      };

      recognizer.sessionStopped = () => {
        setIsListening(false);
        onListeningChange?.(false);
        setIsStarting(false);
      };

    } catch (err) {
      console.error('Error initializing recognizer:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize recognizer');
      setIsStarting(false);
    }
  }, [speechConfig, sttConfig, onRecognizing, onListeningChange, cleanupRecognizer]);

  // Start listening
  const startListening = useCallback(async () => {
    try {
      setError(null);
      setIsStarting(true);
      lastDetectedLocaleRef.current = undefined;
      // Immediately clear buffers
      setInterimText('');
      setRecognizedText('');
      finalSegmentsRef.current = [];
      finalMetadataRef.current = null;

      // Request microphone permission
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        setIsStarting(false);
        throw new Error('Microphone permission denied');
      }

      // Initialize recognizer if not already done
      if (!recognizerRef.current) {
        await initializeRecognizer();
      }

      if (recognizerRef.current) {
        await recognizerRef.current.startContinuousRecognitionAsync();
        setIsListening(true);
        onListeningChange?.(true);
        setIsStarting(false);
      }
    } catch (err) {
      console.error('Error starting speech recognition:', err);
      setError(err instanceof Error ? err.message : 'Failed to start listening');
      setIsStarting(false);
      setIsListening(false);
      onListeningChange?.(false);
    }
  }, [initializeRecognizer, onListeningChange]);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 7000);
    return () => clearTimeout(timer);
  }, [error]);

  // Stop listening
  const stopListening = useCallback(async () => {
    if (recognizerRef.current) {
      try {
        await new Promise<void>((resolve, reject) => {
          recognizerRef.current!.stopContinuousRecognitionAsync(resolve, reject);
        });
        flushRecognizedUtterance();
        setIsListening(false);
        onListeningChange?.(false);
        setIsStarting(false);
        setInterimText('');
      } catch (err) {
        console.error('Error stopping speech recognition:', err);
      }
    }
  }, [flushRecognizedUtterance, onListeningChange]);

  // Cleanup on unmount and page events
  useEffect(() => {
    const handleUnload = () => {
      cleanupRecognizer();
    };

    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);

    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
      cleanupRecognizer();
    };
  }, [cleanupRecognizer]);

  return {
    isListening,
    isStarting,
    recognizedText,
    interimText,
    error,
    startListening,
    stopListening
  };
}

