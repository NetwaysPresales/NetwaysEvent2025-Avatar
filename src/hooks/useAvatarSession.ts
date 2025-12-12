'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';
import type { AvatarConfig, SpeechConfig, TTSConfig, SessionState, AvatarEventData } from '@/types/avatar';
import { fetchICEServerCredentials, createPeerConnection, setupTransceivers, createDataChannel } from '@/lib/webrtc';
import { createSSML } from '@/lib/ssml';

interface UseAvatarSessionProps {
  speechConfig: SpeechConfig;
  avatarConfig: AvatarConfig;
  ttsConfig: TTSConfig;
  onVideoTrack?: (element: HTMLVideoElement) => void;
  onAudioTrack?: (element: HTMLAudioElement) => void;
  onStateChange?: (state: SessionState) => void;
  onEvent?: (event: AvatarEventData) => void;
  autoReconnectMs?: number;
}

export function useAvatarSession({
  speechConfig,
  avatarConfig,
  ttsConfig,
  onVideoTrack,
  onAudioTrack,
  onStateChange,
  onEvent,
  autoReconnectMs
}: UseAvatarSessionProps) {
  const [state, setState] = useState<SessionState>('idle');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const avatarSynthesizerRef = useRef<SpeechSDK.AvatarSynthesizer | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const speechQueueRef = useRef<string[]>([]);
  const currentSpeechRef = useRef<string>('');
  const lastInteractionRef = useRef<Date>(new Date());
  const isReconnectingRef = useRef<boolean>(false);
  const sessionActiveRef = useRef<boolean>(false);

  // Update state and notify parent
  const updateState = useCallback((newState: SessionState) => {
    console.log('[Avatar] State change:', newState);
    setState(newState);
    onStateChange?.(newState);
  }, [onStateChange]);

  // Forward declaration for startSession
  const startSessionRef = useRef<(() => Promise<void>) | null>(null);

  // Start avatar session
  const startSession = useCallback(async () => {
    try {
      // Ensure previous session is fully cleaned up
      if (avatarSynthesizerRef.current || peerConnectionRef.current) {
        console.log('[Avatar] Cleaning up previous session before starting new one...');
        if (avatarSynthesizerRef.current) {
          avatarSynthesizerRef.current.close();
          avatarSynthesizerRef.current = null;
        }
        if (peerConnectionRef.current) {
          peerConnectionRef.current.close();
          peerConnectionRef.current = null;
        }
      }

      updateState('connecting');
      setError(null);

      // Fetch ICE server credentials
      const iceServerConfig = await fetchICEServerCredentials(
        speechConfig.region,
        speechConfig.apiKey,
        speechConfig.enablePrivateEndpoint ? speechConfig.privateEndpoint : undefined
      );

      // Create peer connection
      const peerConnection = createPeerConnection(iceServerConfig);
      peerConnectionRef.current = peerConnection;

      // Setup video track handler
      peerConnection.ontrack = (event) => {
        if (event.track.kind === 'video') {
          const videoElement = document.createElement('video');
          videoElement.srcObject = event.streams[0];
          videoElement.autoplay = true;
          videoElement.playsInline = true;
          onVideoTrack?.(videoElement);
        } else if (event.track.kind === 'audio') {
          const audioElement = document.createElement('audio');
          audioElement.srcObject = event.streams[0];
          audioElement.autoplay = false;
          audioElement.muted = true; // Initially muted for autoplay
          audioElement.addEventListener('loadeddata', () => {
            audioElement.play();
          });
          onAudioTrack?.(audioElement);
        }
      };

      // Setup data channel for events
      peerConnection.addEventListener('datachannel', (event) => {
        const dataChannel = event.channel;
        dataChannel.onmessage = (e) => {
          try {
            const eventData: AvatarEventData = JSON.parse(e.data);
            onEvent?.(eventData);
            console.log('Avatar event:', eventData);

            // Auto-reconnect on SESSION_END (Azure sample pattern)
            if (eventData.event.eventType === 'EVENT_TYPE_SESSION_END') {
              console.log('[Avatar] SESSION_END received');
              if (sessionActiveRef.current && !isReconnectingRef.current) {
                const idleMs = Date.now() - lastInteractionRef.current.getTime();
                const maxIdleMs = autoReconnectMs ?? 300000; // 5 minutes default
                // Reconnect if last interaction was within the timeout window
                if (idleMs < maxIdleMs) {
                  console.log('[Avatar] Auto-reconnecting (last interaction:', Math.floor(idleMs / 1000), 's ago)');
                  isReconnectingRef.current = true;

                  // Trigger event to show meg.png before reconnection
                  if (onEvent) {
                    onEvent({ event: { eventType: 'EVENT_TYPE_RECONNECTING' } });
                  }

                  // Remove old message handler to avoid duplicate reconnects
                  dataChannel.onmessage = null;
                  // Close old connection
                  if (avatarSynthesizerRef.current) {
                    avatarSynthesizerRef.current.close();
                    avatarSynthesizerRef.current = null;
                  }
                  if (peerConnectionRef.current) {
                    peerConnectionRef.current.close();
                    peerConnectionRef.current = null;
                  }
                  // Reconnect after brief delay
                  setTimeout(() => {
                    console.log('[Avatar] Starting reconnection...');
                    updateState('connecting');
                    if (startSessionRef.current) {
                      startSessionRef.current();
                    }
                  }, 1500);
                } else {
                  console.log('[Avatar] No reconnect: idle too long (', Math.floor(idleMs / 1000), 's)');
                  sessionActiveRef.current = false;
                  updateState('idle');
                }
              }
            }
          } catch (err) {
            console.error('Error parsing event data:', err);
          }
        };
      });

      // Monitor connection state
      peerConnection.oniceconnectionstatechange = () => {
        console.log('ICE connection state:', peerConnection.iceConnectionState);
        if (peerConnection.iceConnectionState === 'connected') {
          updateState('connected');
          sessionActiveRef.current = true;
        } else if (peerConnection.iceConnectionState === 'disconnected' || peerConnection.iceConnectionState === 'failed') {
          updateState('disconnected');
        }
      };

      // Create data channel workaround
      createDataChannel(peerConnection);

      // Setup transceivers
      setupTransceivers(peerConnection);

      // Create Speech SDK config
      let sdkSpeechConfig: SpeechSDK.SpeechConfig;
      if (speechConfig.enablePrivateEndpoint && speechConfig.privateEndpoint) {
        const endpoint = speechConfig.privateEndpoint.replace(/^https?:\/\//, '');
        sdkSpeechConfig = SpeechSDK.SpeechConfig.fromEndpoint(
          new URL(`wss://${endpoint}/tts/cognitiveservices/websocket/v1?enableTalkingAvatar=true`),
          speechConfig.apiKey
        );
      } else {
        sdkSpeechConfig = SpeechSDK.SpeechConfig.fromSubscription(
          speechConfig.apiKey,
          speechConfig.region
        );
      }

      if (ttsConfig.customVoiceEndpointId) {
        sdkSpeechConfig.endpointId = ttsConfig.customVoiceEndpointId;
      }

      // Create avatar video format
      const videoFormat = new SpeechSDK.AvatarVideoFormat();

      // Note: Bitrate is controlled by Azure backend and cannot be set via SDK
      // Video quality is determined by the service based on available bandwidth

      if (avatarConfig.videoCrop) {
        videoFormat.setCropRange(
          new SpeechSDK.Coordinate(600, 0),
          new SpeechSDK.Coordinate(1320, 1080)
        );
      }

      // Create avatar config
      const sdkAvatarConfig = new SpeechSDK.AvatarConfig(
        avatarConfig.character,
        avatarConfig.style,
        videoFormat
      );
      sdkAvatarConfig.customized = avatarConfig.customized;
      sdkAvatarConfig.useBuiltInVoice = avatarConfig.useBuiltInVoice;
      // Always use green screen for background removal (include alpha)
      sdkAvatarConfig.backgroundColor = '#00FF00FF';

      // Set ICE servers
      sdkAvatarConfig.remoteIceServers = [{
        urls: iceServerConfig.urls,
        username: iceServerConfig.username,
        credential: iceServerConfig.credential
      }];

      // Create avatar synthesizer
      const avatarSynthesizer = new SpeechSDK.AvatarSynthesizer(sdkSpeechConfig, sdkAvatarConfig);
      avatarSynthesizerRef.current = avatarSynthesizer;

      // Setup avatar event handler
      avatarSynthesizer.avatarEventReceived = (s, e) => {
        console.log(`Avatar event: ${e.description}, offset: ${e.offset / 10000}ms`);
      };

      // Start avatar
      const result = await avatarSynthesizer.startAvatarAsync(peerConnection);

      if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
        console.log('[Avatar] Started successfully. Result ID:', result.resultId);
        lastInteractionRef.current = new Date();
        isReconnectingRef.current = false;

        // Ensure state is properly set to connected
        updateState('connected');
        console.log('[Avatar] State set to connected');

        // Mark session active after 5s to allow WebRTC to stabilize (like Azure sample)
        setTimeout(() => {
          sessionActiveRef.current = true;
          console.log('[Avatar] Session marked as active');
          // Double-check state is still connected after stabilization
          updateState('connected');
        }, 5000);
      } else {
        console.error('[Avatar] Start failed with reason:', result.reason, 'Error details:', result.errorDetails);
        if (result.reason === SpeechSDK.ResultReason.Canceled) {
          throw new Error(`Failed to start avatar: Canceled. ${result.errorDetails || 'No details provided'}`);
        }
        throw new Error(`Failed to start avatar: ${result.reason}`);
      }

    } catch (err) {
      console.error('Error starting avatar session:', err);
      setError(err instanceof Error ? err.message : 'Failed to start session');
      updateState('error');
    }
  }, [speechConfig, avatarConfig, ttsConfig, onVideoTrack, onAudioTrack, onEvent, updateState, autoReconnectMs]);

  // Store startSession in ref for reconnect
  useEffect(() => {
    startSessionRef.current = startSession;
  }, [startSession]);

  // Stop avatar session
  const stopSession = useCallback(() => {
    sessionActiveRef.current = false;
    if (avatarSynthesizerRef.current) {
      avatarSynthesizerRef.current.close();
      avatarSynthesizerRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    speechQueueRef.current = [];
    currentSpeechRef.current = '';
    setIsSpeaking(false);
    updateState('idle');
  }, [updateState]);

  // Speak text
  const speak = useCallback(async (text: string, endingSilenceMs: number = 0) => {
    if (!avatarSynthesizerRef.current || state !== 'connected') {
      console.warn('Cannot speak: session not connected');
      return;
    }

    if (isSpeaking) {
      speechQueueRef.current.push(text);
      return;
    }

    try {
      setIsSpeaking(true);
      updateState('speaking');
      currentSpeechRef.current = text;

      const ssml = createSSML(text, ttsConfig.voice, endingSilenceMs, ttsConfig);
      lastInteractionRef.current = new Date();

      const result = await avatarSynthesizerRef.current.speakSsmlAsync(ssml);

      if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
        console.log('Speech synthesized successfully');
      } else {
        console.error('Speech synthesis failed:', result.errorDetails);
      }

      currentSpeechRef.current = '';

      // Process queue
      if (speechQueueRef.current.length > 0) {
        const nextText = speechQueueRef.current.shift()!;
        setTimeout(() => speak(nextText), 100);
      } else {
        setIsSpeaking(false);
        updateState('connected');
      }

    } catch (err) {
      console.error('Error speaking:', err);
      setIsSpeaking(false);
      updateState('connected');
    }
  }, [state, isSpeaking, ttsConfig, updateState]);

  // Stop speaking
  const stopSpeaking = useCallback(async () => {
    if (avatarSynthesizerRef.current) {
      await avatarSynthesizerRef.current.stopSpeakingAsync();
      speechQueueRef.current = [];
      currentSpeechRef.current = '';
      setIsSpeaking(false);
      updateState('connected');
    }
  }, [updateState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSession();
    };
  }, [stopSession]);

  return {
    state,
    isSpeaking,
    error,
    startSession,
    stopSession,
    touch: () => {
      lastInteractionRef.current = new Date();
    },
    speak,
    stopSpeaking
  };
}

