# Troubleshooting Guide

This guide documents common errors and edge cases encountered when running the Azure Avatar platform, particularly involving obscure WebSocket errors from Azure's backend.

## Azure WebRTC Connection Errors

### Error Code: 1011 (Internal Server Error)

**Symptom**: The avatar page gets stuck on "Connecting to avatar..." or "Initializing...", and the browser console shows the following error thrown by `useAvatarSession`:
`[Avatar] Start failed: 1 "Internal server error. websocket error code: 1011"`

**Cause**: This is Azure WebRTC's generic internal server error. It occurs when you provide a **valid API key and endpoint**, but pass in an **Avatar Character or Text-to-Speech (TTS) Voice** that is invalid or not provisioned for your specific Azure region/subscription. When Azure's backend attempts to initialize the avatar rendering engine with a missing character/voice, the engine crashes and returns this generic 1011 error over the WebSocket.

**Example**: A database profile requests the `'Lisa'` character or the `'en-US-JennyMultilingualNeural'` voice, but the deployed Azure resource only supports the `'Meg'` character and `'en-US-AvaMultilingualNeural'` voice.

**Fix**:

1. Inspect the profile's `avatarConfig` and `ttsConfig` payloads in the database.
2. Ensure the `character` and `voice` properties exactly match the assets supported by your Azure resource.
3. If unsure, clear/nullify these JSON properties in the database for that specific profile. This forces the application to fall back to the global environment variables (`NEXT_PUBLIC_AVATAR_CHARACTER` and `NEXT_PUBLIC_AVATAR_VOICE`), which are known to be working.

---

### Error Code: 4429 (Too Many Requests / Throttled)

**Symptom**: The avatar page fails to connect, and the browser console shows:
`[Avatar] Start failed: 1 "The request is throttled because you have exceeded the concurrent request limit allowed for your sub websocket error code: 4429"`

**Cause**: Azure Speech enforces a strict concurrency limit (e.g., 1 concurrent stream). When a user closes an avatar session or reloads the page, the frontend successfully sends a `close()` signal to the WebSocket. However, **Azure's backend takes approximately 2 to 5 seconds to physically tear down the session and release the concurrency lock**. If a new connection is attempted within this teardown window (very common during Next.js Hot Module Reloading or fast navigation), Azure rejects the new connection with a 4429 response.

**Fix**:
The `AvatarPage` component is equipped to trap this exact error payload. When detected, the UI gracefully displays *"Azure is closing your previous session limit. Retrying in 3 seconds..."* and internally queues a `setTimeout` to retry the WebRTC connection once the Azure cooldown lock is released. A manual "Retry Connection" button is also exposed in the error overlay.
