/**
 * Theme and Accent Color Management
 * 
 * Provides utilities for managing CSS variables for theme and accent colors.
 * This enables per-profile accent color customization.
 */

export interface AccentColor {
  r: number;
  g: number;
  b: number;
}

export interface AccentColorPalette {
  primary: string;        // Main accent color (buttons, borders)
  primaryHover: string;   // Hover state
  primaryLight: string;   // Light backgrounds
  primaryDark: string;    // Dark backgrounds
  focusRing: string;      // Focus ring color
  text: string;           // Text on accent background
}

/**
 * Convert RGB to hex color
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('')}`;
}

/**
 * Generate accent color palette from RGB
 */
export function generateAccentPalette(accentColor: AccentColor | null): AccentColorPalette {
  // Default to emerald-500 if no accent color provided
  const defaultColor = { r: 16, g: 185, b: 129 };
  const color = accentColor || defaultColor;

  const primary = rgbToHex(color.r, color.g, color.b);
  
  // Generate hover (lighter)
  const hoverR = Math.min(255, color.r + 20);
  const hoverG = Math.min(255, color.g + 20);
  const hoverB = Math.min(255, color.b + 20);
  const primaryHover = rgbToHex(hoverR, hoverG, hoverB);

  // Generate light background (very light)
  const lightR = Math.min(255, Math.floor(color.r * 0.1 + 240));
  const lightG = Math.min(255, Math.floor(color.g * 0.1 + 240));
  const lightB = Math.min(255, Math.floor(color.b * 0.1 + 240));
  const primaryLight = rgbToHex(lightR, lightG, lightB);

  // Generate dark (darker)
  const darkR = Math.max(0, color.r - 30);
  const darkG = Math.max(0, color.g - 30);
  const darkB = Math.max(0, color.b - 30);
  const primaryDark = rgbToHex(darkR, darkG, darkB);

  // Focus ring (primary with opacity)
  const focusRing = `rgba(${color.r}, ${color.g}, ${color.b}, 0.5)`;

  // Text color (white or black based on relative luminance)
  // Use WCAG contrast ratio calculation for better accessibility
  // For colored backgrounds, prefer white text unless the color is very light
  const luminance = (0.299 * color.r + 0.587 * color.g + 0.114 * color.b) / 255;
  // Use a higher threshold (0.7) to prefer white text on most colored backgrounds
  // This ensures good contrast on green, blue, and other medium-bright colors
  // Only use black text on very light colors (like yellow, light cyan)
  const text = luminance > 0.7 ? '#000000' : '#ffffff';

  return {
    primary,
    primaryHover,
    primaryLight,
    primaryDark,
    focusRing,
    text,
  };
}

/**
 * Apply accent color palette to CSS variables
 */
export function applyAccentColor(palette: AccentColorPalette): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  root.style.setProperty('--accent-primary', palette.primary);
  root.style.setProperty('--accent-primary-hover', palette.primaryHover);
  root.style.setProperty('--accent-primary-light', palette.primaryLight);
  root.style.setProperty('--accent-primary-dark', palette.primaryDark);
  root.style.setProperty('--accent-focus-ring', palette.focusRing);
  root.style.setProperty('--accent-text', palette.text);
}

/**
 * Apply theme to document root
 */
export function applyTheme(theme: 'light' | 'dark'): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

