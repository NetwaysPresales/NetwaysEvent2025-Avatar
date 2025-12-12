'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';
import type { SpeechConfig, STTConfig } from '@/types/avatar';

interface UseSpeechRecognitionProps {
  speechConfig: SpeechConfig;
  sttConfig: STTConfig;
  onRecognized?: (text: string) => void;
  onRecognizing?: (text: string) => void;
}

export function useSpeechRecognition({
  speechConfig,
  sttConfig,
  onRecognized,
  onRecognizing
}: UseSpeechRecognitionProps) {
  const [isListening, setIsListening] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [interimText, setInterimText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recognizerRef = useRef<SpeechSDK.SpeechRecognizer | null>(null);

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
  const initializeRecognizer = useCallback(() => {
    try {
      // Cleanup any existing recognizer first
      cleanupRecognizer();

      // Create speech config
      let sdkSpeechConfig: SpeechSDK.SpeechConfig;
      if (speechConfig.enablePrivateEndpoint && speechConfig.privateEndpoint) {
        const endpoint = speechConfig.privateEndpoint.replace(/^https?:\/\//, '');
        sdkSpeechConfig = SpeechSDK.SpeechConfig.fromEndpoint(
          new URL(`wss://${endpoint}/stt/speech/universal/v2`),
          speechConfig.apiKey
        );
      } else {
        sdkSpeechConfig = SpeechSDK.SpeechConfig.fromEndpoint(
          new URL(`wss://${speechConfig.region}.stt.speech.microsoft.com/speech/universal/v2`),
          speechConfig.apiKey
        );
      }

      // Enable continuous language detection
      sdkSpeechConfig.setProperty(
        SpeechSDK.PropertyId.SpeechServiceConnection_LanguageIdMode,
        'Continuous'
      );

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
      const autoDetectConfig = SpeechSDK.AutoDetectSourceLanguageConfig.fromLanguages(
        sttConfig.locales
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
          setInterimText(text);
          onRecognizing?.(text);
        }
      };

      recognizer.recognized = (s, e) => {
        if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
          const text = e.result.text.trim();
          // Log detected language for debugging
          const detectedLanguage = e.result.language || 'unknown';
          console.log('Speech recognized:', text, '| Detected language:', detectedLanguage);

          if (text) {
            setRecognizedText(text);
            setInterimText('');
            onRecognized?.(text);

            // Auto-stop if not continuous - recognition will complete automatically
            if (!sttConfig.continuousConversation) {
              // Delay to ensure the recognition is processed
              setTimeout(() => {
                if (recognizerRef.current) {
                  recognizerRef.current.stopContinuousRecognitionAsync(
                    () => {
                      console.log('Recognition stopped after utterance');
                      setIsListening(false);
                      setIsStarting(false);
                    },
                    (err) => {
                      console.error('Error stopping recognition:', err);
                      setIsListening(false);
                      setIsStarting(false);
                    }
                  );
                }
              }, 100);
            }
          }
        }
      };

      recognizer.canceled = (s, e) => {
        console.error('Speech recognition canceled:', e.errorDetails);
        setError(e.errorDetails);
        setIsListening(false);
        setIsStarting(false);
      };

      recognizer.sessionStopped = () => {
        console.log('[STT] Session stopped');
        setIsListening(false);
        setIsStarting(false);
      };

    } catch (err) {
      console.error('Error initializing recognizer:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize recognizer');
      setIsStarting(false);
    }
  }, [speechConfig, sttConfig, onRecognized, onRecognizing, cleanupRecognizer]);

  // Start listening
  const startListening = useCallback(async () => {
    try {
      setError(null);
      setIsStarting(true);
      // Immediately clear buffers
      setInterimText('');
      setRecognizedText('');

      // Request microphone permission
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        setIsStarting(false);
        throw new Error('Microphone permission denied');
      }

      // Initialize recognizer if not already done
      if (!recognizerRef.current) {
        initializeRecognizer();
      }

      if (recognizerRef.current) {
        await recognizerRef.current.startContinuousRecognitionAsync();
        setIsListening(true);
        setIsStarting(false);
      }
    } catch (err) {
      console.error('Error starting speech recognition:', err);
      setError(err instanceof Error ? err.message : 'Failed to start listening');
      setIsStarting(false);
      setIsListening(false);
    }
  }, [initializeRecognizer]);

  // Stop listening
  const stopListening = useCallback(async () => {
    if (recognizerRef.current) {
      try {
        await recognizerRef.current.stopContinuousRecognitionAsync();
        setIsListening(false);
        setIsStarting(false);
        setInterimText('');
      } catch (err) {
        console.error('Error stopping speech recognition:', err);
      }
    }
  }, []);

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

