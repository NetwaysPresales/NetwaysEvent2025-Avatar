# State Management Analysis

## Critical Issues Found

### 1. Theme State Duplication ⚠️ CRITICAL
**Location**: `src/components/LandingPage/LandingPage.tsx`

**Problem**: 
- `LandingPage` maintains `localTheme` state that duplicates theme from `ProfileContext`
- This creates a potential desynchronization where UI shows one theme while profile has another
- Theme is also passed as prop to many components instead of using `useTheme()` hook

**Impact**: 
- Theme changes in ProfileContext may not reflect immediately in LandingPage
- Multiple sources of truth for theme state

**Fix Required**: Remove `localTheme` and use `useTheme()` directly

---

### 2. Theme Prop Drilling ⚠️ MODERATE
**Locations**: Multiple components receive `theme` as prop

**Problem**:
- `PageHeader`, `UserMenu`, `EntityInfoCards`, `VoiceInput`, `SubtitlesDisplay`, `AvatarBackground`, `LoadingOverlay`, and all settings components receive `theme` as prop
- This creates unnecessary prop drilling and potential desynchronization

**Impact**:
- If theme changes in ProfileContext, components won't update unless parent re-renders
- More code to maintain, harder to refactor

**Fix Required**: Replace all `theme` props with `useTheme()` hook calls

---

### 3. Direct API Calls Instead of Context Methods ⚠️ MODERATE
**Locations**: 
- `src/components/AssetUpload/DragDropUpload.tsx`
- `src/components/AssetUpload/AssetUpload.tsx`

**Problem**:
- These components make direct `fetch()` calls to `/api/profiles/${profileId}/assets` and `/api/profiles/${profileId}/knowledge`
- They don't use ProfileContext methods, which means:
  - Profile state won't automatically refresh after upload
  - No centralized error handling
  - Potential race conditions if multiple uploads happen

**Impact**:
- After uploading logo/background, the profile state in context may be stale
- Need to manually refresh or reload profile

**Fix Required**: 
- Option 1: Add upload methods to ProfileContext
- Option 2: Call `refreshProfiles()` and `loadProfile()` after successful upload

---

### 4. Profile State Management ✅ GOOD
**Location**: `src/context/ProfileContext.tsx`

**Status**: ✅ Single source of truth
- All profile operations go through ProfileContext
- State machine pattern ensures atomic updates
- No duplicate profile state found

---

### 5. Avatar Session State ✅ GOOD
**Location**: `src/hooks/useAvatarSession.ts`

**Status**: ✅ Properly isolated
- Avatar session state is isolated to the hook
- No duplication with profile state
- Properly scoped to avatar interaction lifecycle

---

## Summary

### Critical Fixes Needed:
1. **Remove `localTheme` from LandingPage** - Use `useTheme()` directly
2. **Remove theme prop drilling** - Replace all `theme` props with `useTheme()` hook
3. **Integrate upload components with ProfileContext** - Either add methods to context or refresh after upload

### Good Patterns:
- ProfileContext is the single source of truth for profile data
- Avatar session state is properly isolated
- No duplicate profile state management

