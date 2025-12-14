# Critical Code Analysis & Recommendations

## Executive Summary

This codebase implements an Azure Avatar integration with speech recognition, but suffers from several architectural issues that impact reliability, maintainability, and user experience. The main problems are: race conditions in state management, improper resource cleanup, fragile error handling, and tight coupling between components.

---

## 1. Avatar Setup Code (`useAvatarSession.ts`)

### Critical Issues

#### 1.1 Race Conditions in State Management
**Problem**: State is managed through both React state (`useState`) and refs (`useRef`), creating opportunities for desynchronization.

**Current Code**:
```typescript
const [state, setState] = useState<SessionState>('idle');
const sessionActiveRef = useRef<boolean>(false);
const isReconnectingRef = useRef<boolean>(false);

// Later...
setTimeout(() => {
  sessionActiveRef.current = true; // Ref updated
  updateState('connected'); // State updated separately
}, 5000);
```

**Issues**:
- State and refs can get out of sync
- The 5-second delay is arbitrary and not based on actual connection state
- No validation that state transitions are valid

**Alternative Approach**:
```typescript
// Use a single source of truth with proper state machine
type SessionState = 
  | { type: 'idle' }
  | { type: 'connecting'; startTime: number }
  | { type: 'connected'; peerConnection: RTCPeerConnection; synthesizer: AvatarSynthesizer }
  | { type: 'reconnecting'; previousState: SessionState }
  | { type: 'error'; error: Error; recoverable: boolean };

const [sessionState, setSessionState] = useState<SessionState>({ type: 'idle' });

// State transitions are explicit and validated
const transitionToConnected = (pc: RTCPeerConnection, synth: AvatarSynthesizer) => {
  setSessionState({ 
    type: 'connected', 
    peerConnection: pc, 
    synthesizer: synth 
  });
};
```

#### 1.2 DOM Element Lifecycle Management
**Problem**: Video and audio elements are created in callbacks and appended to DOM without proper tracking or cleanup.

**Current Code**:
```typescript
peerConnection.ontrack = (event) => {
  if (event.track.kind === 'video') {
    const videoElement = document.createElement('video');
    // No tracking, no cleanup mechanism
    onVideoTrack?.(videoElement);
  }
}
```

**Alternative Approach**:
```typescript
// Track elements in refs and cleanup properly
const videoElementRef = useRef<HTMLVideoElement | null>(null);
const audioElementRef = useRef<HTMLAudioElement | null>(null);

const cleanupMediaElements = useCallback(() => {
  if (videoElementRef.current) {
    videoElementRef.current.srcObject = null;
    videoElementRef.current.remove();
    videoElementRef.current = null;
  }
  if (audioElementRef.current) {
    audioElementRef.current.srcObject = null;
    audioElementRef.current.remove();
    audioElementRef.current = null;
  }
}, []);

// In ontrack handler:
peerConnection.ontrack = (event) => {
  if (event.track.kind === 'video') {
    cleanupMediaElements(); // Clean old first
    const videoElement = document.createElement('video');
    videoElementRef.current = videoElement;
    // Setup element...
    onVideoTrack?.(videoElement);
  }
};

// In cleanup:
useEffect(() => {
  return () => {
    cleanupMediaElements();
    // ... other cleanup
  };
}, []);
```

#### 1.3 Fragile Reconnection Logic
**Problem**: The reconnection logic in the data channel handler is complex and error-prone.

**Current Code**:
```typescript
dataChannel.onmessage = (e) => {
  // ...
  if (eventData.event.eventType === 'EVENT_TYPE_SESSION_END') {
    // Remove own handler while processing
    dataChannel.onmessage = null;
    // Close connections
    // Reconnect after delay
    setTimeout(() => {
      if (startSessionRef.current) {
        startSessionRef.current();
      }
    }, 1500);
  }
};
```

**Issues**:
- Removing handler while processing can cause race conditions
- No debouncing - multiple events could trigger multiple reconnects
- Hardcoded delay without justification
- No exponential backoff for failures

**Alternative Approach**:
```typescript
// Use a proper reconnection manager
class ReconnectionManager {
  private reconnectAttempts = 0;
  private maxAttempts = 5;
  private baseDelay = 1000;
  private isReconnecting = false;
  private reconnectTimer: NodeJS.Timeout | null = null;

  async attemptReconnect(
    onReconnect: () => Promise<void>,
    onFailure: (error: Error) => void
  ): Promise<void> {
    if (this.isReconnecting) return;
    
    if (this.reconnectAttempts >= this.maxAttempts) {
      onFailure(new Error('Max reconnection attempts reached'));
      return;
    }

    this.isReconnecting = true;
    const delay = this.baseDelay * Math.pow(2, this.reconnectAttempts);
    
    this.reconnectTimer = setTimeout(async () => {
      try {
        await onReconnect();
        this.reconnectAttempts = 0; // Reset on success
        this.isReconnecting = false;
      } catch (error) {
        this.reconnectAttempts++;
        this.isReconnecting = false;
        if (this.reconnectAttempts < this.maxAttempts) {
          this.attemptReconnect(onReconnect, onFailure);
        } else {
          onFailure(error as Error);
        }
      }
    }, delay);
  }

  cancel(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.isReconnecting = false;
  }
}

// Use with debouncing
const reconnectionManagerRef = useRef(new ReconnectionManager());
const debouncedReconnect = useMemo(
  () => debounce((onReconnect: () => Promise<void>) => {
    reconnectionManagerRef.current.attemptReconnect(onReconnect, (error) => {
      setError(error.message);
      updateState('error');
    });
  }, 2000), // 2 second debounce
  []
);
```

#### 1.4 Missing Error Recovery
**Problem**: Errors set state but don't attempt recovery.

**Alternative**: Implement retry logic with exponential backoff and user feedback.

---

## 2. Microphone Audio Handling (`useSpeechRecognition.ts`)

### Critical Issues

#### 2.1 Permission Handling
**Problem**: Microphone permission is requested every time without caching.

**Current Code**:
```typescript
const startListening = useCallback(async () => {
  try {
    await navigator.mediaDevices.getUserMedia({ audio: true });
    // Permission requested every time
  } catch {
    throw new Error('Microphone permission denied');
  }
}, []);
```

**Alternative Approach**:
```typescript
// Cache permission state
const permissionStateRef = useRef<'granted' | 'denied' | 'prompt' | null>(null);

const checkMicrophonePermission = useCallback(async (): Promise<boolean> => {
  if (permissionStateRef.current === 'granted') {
    return true;
  }
  
  if (permissionStateRef.current === 'denied') {
    throw new Error('Microphone permission was previously denied');
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Check actual permission status
    const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
    permissionStateRef.current = result.state as 'granted' | 'denied' | 'prompt';
    
    // Stop the stream immediately - we just needed permission
    stream.getTracks().forEach(track => track.stop());
    
    return permissionStateRef.current === 'granted';
  } catch (error) {
    permissionStateRef.current = 'denied';
    throw new Error('Microphone permission denied');
  }
}, []);
```

#### 2.2 Initialization Race Condition
**Problem**: Recognizer initialization happens conditionally inside `startListening`, creating race conditions.

**Current Code**:
```typescript
if (!recognizerRef.current) {
  initializeRecognizer(); // Synchronous call, but internal setup is async
}
if (recognizerRef.current) { // This might still be null
  await recognizerRef.current.startContinuousRecognitionAsync();
}
```

**Alternative Approach**:
```typescript
// Make initialization async and await it
const initializeRecognizer = useCallback(async (): Promise<void> => {
  if (recognizerRef.current) return; // Already initialized
  
  try {
    // ... setup code ...
    recognizerRef.current = recognizer;
    // Wait for recognizer to be ready
    await new Promise<void>((resolve) => {
      recognizer.sessionStarted = () => resolve();
    });
  } catch (error) {
    recognizerRef.current = null;
    throw error;
  }
}, [/* deps */]);

const startListening = useCallback(async () => {
  try {
    await checkMicrophonePermission();
    
    // Always ensure recognizer is initialized
    await initializeRecognizer();
    
    if (!recognizerRef.current) {
      throw new Error('Failed to initialize recognizer');
    }
    
    await recognizerRef.current.startContinuousRecognitionAsync();
    setIsListening(true);
  } catch (error) {
    // Handle error
  }
}, [checkMicrophonePermission, initializeRecognizer]);
```

#### 2.3 Auto-Stop Logic
**Problem**: Using `setTimeout` for auto-stop is fragile and unreliable.

**Alternative Approach**:
```typescript
// Use event-driven approach instead of timers
recognizer.recognized = (s, e) => {
  if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
    const text = e.result.text.trim();
    if (text) {
      setRecognizedText(text);
      onRecognized?.(text);
      
      // Auto-stop based on configuration
      if (!sttConfig.continuousConversation) {
        // Use sessionStopped event instead of setTimeout
        recognizer.stopContinuousRecognitionAsync(
          () => {
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
    }
  }
};
```

#### 2.4 Missing Stream Cleanup
**Problem**: Audio streams created by `AudioConfig.fromDefaultMicrophoneInput()` are not explicitly cleaned up.

**Alternative Approach**:
```typescript
// Track and cleanup audio streams
const audioStreamRef = useRef<MediaStream | null>(null);

const initializeRecognizer = useCallback(async () => {
  // Get stream explicitly so we can track it
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  audioStreamRef.current = stream;
  
  const audioConfig = SpeechSDK.AudioConfig.fromStreamInput(stream);
  // ... rest of setup
}, []);

const cleanupRecognizer = useCallback(() => {
  if (recognizerRef.current) {
    recognizerRef.current.close();
    recognizerRef.current = null;
  }
  
  // Cleanup audio stream
  if (audioStreamRef.current) {
    audioStreamRef.current.getTracks().forEach(track => track.stop());
    audioStreamRef.current = null;
  }
}, []);
```

---

## 3. Avatar Video Handling (`useGreenScreen.ts`)

### Critical Issues

#### 3.1 WebGL Context Loss Handling
**Problem**: No handling for WebGL context loss events.

**Alternative Approach**:
```typescript
const initWebGL = (canvas: HTMLCanvasElement) => {
  const gl = canvas.getContext('webgl', {
    premultipliedAlpha: false,
    alpha: true,
    preserveDrawingBuffer: false // Better performance
  });

  if (!gl) {
    console.error('WebGL not supported');
    return;
  }
  
  glRef.current = gl;

  // Handle context loss
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    console.warn('WebGL context lost, attempting to restore...');
    stopProcessing();
    // Attempt to restore
    setTimeout(() => {
      initWebGL(canvas);
      startProcessing();
    }, 1000);
  }, false);

  canvas.addEventListener('webglcontextrestored', () => {
    console.log('WebGL context restored');
    // Reinitialize WebGL resources
    initWebGL(canvas);
  }, false);

  // ... rest of initialization
};
```

#### 3.2 Performance Optimization
**Problem**: Texture is uploaded every frame without checking if video has data ready.

**Context**: This is a live stream from Azure Avatar service, so frames are always different and video is never paused. However, we should still check video readiness before uploading to texture.

**Alternative Approach**:
```typescript
const renderLoop = () => {
  if (!processingRef.current) return;

  const video = document.getElementById('avatar-video') as HTMLVideoElement;
  // ... validation ...

  // Only update texture if video has data ready
  // For live streams, every frame is different, but we still need to check readiness
  if (video.readyState >= 2) { // HAVE_CURRENT_DATA
    gl.bindTexture(gl.TEXTURE_2D, textureRef.current);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
  } else {
    // Video not ready yet, skip this frame
    rafRef.current = requestAnimationFrame(renderLoop);
    return;
  }

  // ... rest of rendering ...
};
```

#### 3.3 Configurable Shader Parameters
**Problem**: Chroma key thresholds are hardcoded in shader.

**Alternative Approach**:
```typescript
// Make thresholds configurable via uniforms
const fsSource = `
  precision mediump float;
  uniform sampler2D u_image;
  uniform vec2 u_texStep;
  uniform vec3 u_chromaKey; // RGB of key color
  uniform float u_hueThreshold;
  uniform float u_satThreshold;
  uniform float u_valThreshold;
  uniform float u_edgeTolerance;
  varying vec2 v_texCoord;
  // ... rest of shader using uniforms ...
`;

// Set uniforms from config
const chromaKeyLocation = gl.getUniformLocation(program, 'u_chromaKey');
const hueThresholdLocation = gl.getUniformLocation(program, 'u_hueThreshold');
// ... etc

// In render loop:
gl.uniform3f(chromaKeyLocation, 0.0, 1.0, 0.0); // Green
gl.uniform1f(hueThresholdLocation, 0.08);
// ... etc
```

#### 3.4 Frame Rate Limiting (Not Applicable for Live Streams)
**Context**: Since this is a live stream from Azure Avatar service that never pauses, frame rate limiting based on pause state is not applicable. However, we could still implement frame rate limiting if needed for performance reasons (e.g., cap at 30fps instead of 60fps).

**Note**: The current implementation runs at full refresh rate (typically 60fps), which is appropriate for a live avatar stream. If performance becomes an issue, consider:

**Alternative Approach** (if frame rate limiting is needed):
```typescript
let lastFrameTime = 0;
const targetFPS = 30; // Cap at 30fps if needed
const frameInterval = 1000 / targetFPS;

const renderLoop = (currentTime: number) => {
  if (!processingRef.current) return;

  const video = document.getElementById('avatar-video') as HTMLVideoElement;
  if (!video || video.readyState < 2) {
    rafRef.current = requestAnimationFrame(renderLoop);
    return;
  }

  // Throttle frame rate if needed
  const elapsed = currentTime - lastFrameTime;
  if (elapsed < frameInterval) {
    rafRef.current = requestAnimationFrame(renderLoop);
    return;
  }

  lastFrameTime = currentTime - (elapsed % frameInterval);

  // ... rendering code ...

  rafRef.current = requestAnimationFrame(renderLoop);
};
```

**Recommendation**: For live avatar streams, running at full refresh rate (60fps) is typically desired for smooth animation. Only implement frame rate limiting if you experience performance issues.

---

## 4. Integration Issues (`avatar/page.tsx`)

### Critical Issues

#### 4.1 Auto-Start Logic
**Problem**: Using refs to prevent double-start is fragile.

**Alternative Approach**:
```typescript
// Use a proper state machine instead of refs
const [sessionStatus, setSessionStatus] = useState<
  'idle' | 'starting' | 'started' | 'error'
>('idle');

useEffect(() => {
  if (sessionStatus !== 'idle' || !currentProfile) return;
  
  setSessionStatus('starting');
  handleStartSession()
    .then(() => setSessionStatus('started'))
    .catch(() => setSessionStatus('error'));
}, [currentProfile, sessionStatus, handleStartSession]);
```

#### 4.2 Video Element Management
**Problem**: Video elements appended to body without proper lifecycle management.

**Alternative Approach**:
```typescript
// Use a ref container in the component instead of body
const videoContainerRef = useRef<HTMLDivElement>(null);

// In JSX:
<div ref={videoContainerRef} className="hidden" />

// In onVideoTrack:
onVideoTrack: (element) => {
  if (videoContainerRef.current) {
    // Clear existing
    videoContainerRef.current.innerHTML = '';
    // Append new
    videoContainerRef.current.appendChild(element);
  }
}
```

---

## 5. General Architecture Recommendations

### 5.1 Error Boundaries
Add React Error Boundaries to catch and handle errors gracefully:

```typescript
class AvatarErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Avatar error:', error, errorInfo);
    // Log to error tracking service
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} onRetry={this.handleRetry} />;
    }
    return this.props.children;
  }
}
```

### 5.2 Resource Management
Create a unified resource manager:

```typescript
class ResourceManager {
  private resources: Set<{ dispose: () => void }> = new Set();

  register(resource: { dispose: () => void }) {
    this.resources.add(resource);
    return resource;
  }

  dispose() {
    this.resources.forEach(r => {
      try {
        r.dispose();
      } catch (error) {
        console.error('Error disposing resource:', error);
      }
    });
    this.resources.clear();
  }
}
```

### 5.3 Testing
Add unit tests for critical paths:
- State transitions
- Error recovery
- Resource cleanup
- Reconnection logic

### 5.4 Monitoring
Add performance and error monitoring:
- Track connection times
- Monitor WebGL context losses
- Log reconnection attempts
- Track microphone permission states

---

## Summary of Priority Fixes

1. **High Priority**:
   - Fix race conditions in state management
   - Implement proper resource cleanup
   - Add error recovery mechanisms
   - Fix reconnection logic with debouncing

2. **Medium Priority**:
   - Optimize WebGL rendering
   - Improve microphone permission handling
   - Add WebGL context loss handling
   - Refactor auto-start logic

3. **Low Priority**:
   - Make shader parameters configurable
   - Add frame rate limiting
   - Improve code documentation
   - Add comprehensive error boundaries

