/**
 * WebRTC utilities for Azure Avatar service
 */

import type { ICEServerConfig, SpeechConfig } from '@/types/avatar';

export interface SpeechSessionCredentials {
  region: string;
  ice: ICEServerConfig;
  apiKey?: string;
  authorizationToken?: string;
}

/**
 * Fetch ICE server credentials from Azure
 */
export async function fetchICEServerCredentials(
  region: string,
  apiKey: string,
  privateEndpoint?: string
): Promise<ICEServerConfig> {
  const endpoint = privateEndpoint?.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const url = endpoint
    ? `https://${endpoint}/tts/cognitiveservices/avatar/relay/token/v1`
    : `https://${region}.tts.speech.microsoft.com/cognitiveservices/avatar/relay/token/v1`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Ocp-Apim-Subscription-Key': apiKey
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ICE server credentials: ${response.status}`);
  }

  const data = await response.json() as {
    Urls: string[];
    Username: string;
    Password: string;
  };

  const turnUrls = data.Urls.filter((url) => url.startsWith('turn:') || url.startsWith('turns:'));

  return {
    urls: turnUrls.length > 0 ? turnUrls : data.Urls,
    username: data.Username,
    credential: data.Password
  };
}

/**
 * Use a profile-supplied key when present, otherwise request short-lived
 * Speech and TURN credentials from the authenticated server endpoint.
 */
export async function fetchSpeechSessionCredentials(
  config: SpeechConfig
): Promise<SpeechSessionCredentials> {
  if (config.apiKey) {
    return {
      region: config.region,
      apiKey: config.apiKey,
      ice: await fetchICEServerCredentials(
        config.region,
        config.apiKey,
        config.enablePrivateEndpoint ? config.privateEndpoint : undefined
      ),
    };
  }

  const response = await fetch('/api/speech/token', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to obtain Azure Speech credentials: ${response.status}`);
  }

  return response.json() as Promise<SpeechSessionCredentials>;
}

/**
 * Create WebRTC peer connection
 */
export function createPeerConnection(
  iceServerConfig: ICEServerConfig,
  useTcpForWebRTC: boolean = false
): RTCPeerConnection {
  const iceServerUrl = iceServerConfig.urls[0];
  const modifiedUrl = useTcpForWebRTC
    ? iceServerUrl.replace(':3478', ':443?transport=tcp')
    : iceServerUrl;

  return new RTCPeerConnection({
    iceServers: [{
      urls: [modifiedUrl],
      username: iceServerConfig.username,
      credential: iceServerConfig.credential
    }],
    iceTransportPolicy: useTcpForWebRTC ? 'relay' : 'all'
  });
}

/**
 * Setup video/audio transceivers for peer connection
 */
export function setupTransceivers(peerConnection: RTCPeerConnection): void {
  peerConnection.addTransceiver('video', { direction: 'sendrecv' });
  peerConnection.addTransceiver('audio', { direction: 'sendrecv' });
}

/**
 * Create a data channel workaround for event listening
 */
export function createDataChannel(peerConnection: RTCPeerConnection): RTCDataChannel {
  return peerConnection.createDataChannel('eventChannel');
}
