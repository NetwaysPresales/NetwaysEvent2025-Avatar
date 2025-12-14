# Components Structure

This directory contains all React components organized by feature and composition hierarchy.

## Structure Overview

### Page Components
- **`AvatarPage/`** - Main avatar interaction page
  - Composes: `AvatarRenderer`, `VoiceInput`, `SubtitlesDisplay`, `PageHeader`, `EntityInfoCards`
- **`LandingPage/`** - Profile selection and start experience
  - **`CreateProfileModal.tsx`** - Modal for creating new profiles (only used by LandingPage)
  - Composes: `ProfileList`, `ProfileManager`, `SettingsModal`, `UserMenu`

### Feature Components

#### Avatar Components (`avatar/`)
- **`AvatarRenderer.tsx`** - WebGL green screen processing and canvas rendering
- **`VoiceInput.tsx`** - Microphone input with keyboard shortcuts
- **`SubtitlesDisplay.tsx`** - Conversation subtitles with auto-scroll

#### Profile Management (`ProfileList/`, `ProfileManager/`)
- **`ProfileList/`** - Profile selection and display
  - **`DeleteProfileConfirmation.tsx`** - Delete confirmation modal (only used by ProfileList)
- **`ProfileManager/`** - Profile creation form (used in modals)

#### Entity Information (`EntityInfoCards/`)
- **`EntityInfoCards.tsx`** - Dynamically composable entity information display
  - TODO: Make sections configurable per profile (entity visualization system)

#### Settings (`settings/`)
- **`SettingsModal.tsx`** - Main settings container with tabs
- **`AvatarSettings.tsx`** - Avatar configuration
- **`SpeechSettings.tsx`** - Speech service configuration
- **`TTSSettings.tsx`** - Text-to-speech configuration
- **`OpenAISettings.tsx`** - OpenAI configuration
- **`AppearanceSettings.tsx`** - Appearance customization
- **`KnowledgeSettings.tsx`** - Knowledge base management

### UI Components (`ui/`)
Base reusable components:
- `Button.tsx` - Button with variants
- `Input.tsx` - Form input
- `Textarea.tsx` - Textarea input
- `Card.tsx` - Card container

### Utility Components
- **`AssetUpload/`** - File upload component
- **`AvatarBackground/`** - Background image/video renderer
- **`LoadingOverlay/`** - Loading state overlay
- **`AuthPage/`** - Sign-in page
- **`navigation/`** - Navigation components
  - **`PageHeader.tsx`** - Reusable page header
- **`user/`** - User-related components
  - **`UserMenu.tsx`** - User profile menu with logout

### Providers (`providers/`)
- **`SessionProviderWrapper.tsx`** - NextAuth session provider wrapper

## Component Composition Rules

1. **Private Components**: If a component is only used by one parent component, place it in the parent's directory (e.g., `CreateProfileModal` in `LandingPage/`)

2. **Shared Components**: Components used by multiple parents go in their own directory at the root level

3. **Feature Groups**: Related components are grouped in feature directories (e.g., `avatar/`, `settings/`)

4. **UI Components**: Base UI components that are reused across the app go in `ui/`

