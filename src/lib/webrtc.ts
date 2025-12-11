/**
 * WebRTC utilities for Azure Avatar service
 */

import type { ICEServerConfig } from '@/types/avatar';

/**
 * Fetch ICE server credentials from Azure
 */
export async function fetchICEServerCredentials(
  region: string,
  apiKey: string,
  privateEndpoint?: string
): Promise<ICEServerConfig> {
  const url = privateEndpoint
    ? `https://${privateEndpoint}/tts/cognitiveservices/avatar/relay/token/v1`
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

  const data = await response.json();
  
  return {
    urls: [data.Urls[0]],
    username: data.Username,
    credential: data.Password
  };
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

