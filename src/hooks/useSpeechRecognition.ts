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
  const [recognizedText, setRecognizedText] = useState('');
  const [interimText, setInterimText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recognizerRef = useRef<SpeechSDK.SpeechRecognizer | null>(null);

  // Initialize recognizer
  const initializeRecognizer = useCallback(() => {
    try {
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
                    },
                    (err) => {
                      console.error('Error stopping recognition:', err);
                      setIsListening(false);
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
      };

      recognizer.sessionStopped = () => {
        console.log('[STT] Session stopped');
        setIsListening(false);
      };

    } catch (err) {
      console.error('Error initializing recognizer:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize recognizer');
    }
  }, [speechConfig, sttConfig, onRecognized, onRecognizing]);

  // Start listening
  const startListening = useCallback(async () => {
    try {
      setError(null);

      // Request microphone permission
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        throw new Error('Microphone permission denied');
      }

      // Initialize recognizer if not already done
      if (!recognizerRef.current) {
        initializeRecognizer();
      }

      if (recognizerRef.current) {
        await recognizerRef.current.startContinuousRecognitionAsync();
        setIsListening(true);
      }
    } catch (err) {
      console.error('Error starting speech recognition:', err);
      setError(err instanceof Error ? err.message : 'Failed to start listening');
    }
  }, [initializeRecognizer]);

  // Stop listening
  const stopListening = useCallback(async () => {
    if (recognizerRef.current) {
      try {
        await recognizerRef.current.stopContinuousRecognitionAsync();
        setIsListening(false);
        setInterimText('');
      } catch (err) {
        console.error('Error stopping speech recognition:', err);
      }
    }
  }, []);

  // Cleanup on unmount and reset state
  useEffect(() => {
    return () => {
      if (recognizerRef.current) {
        recognizerRef.current.close();
        recognizerRef.current = null;
      }
      setIsListening(false);
      setError(null);
      setRecognizedText('');
      setInterimText('');
    };
  }, []);

  return {
    isListening,
    recognizedText,
    interimText,
    error,
    startListening,
    stopListening
  };
}

