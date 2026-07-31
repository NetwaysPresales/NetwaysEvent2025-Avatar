export function getLanguageDisplay(locale?: string): string | undefined {
  if (!locale) return undefined;
  try {
    const parsed = new Intl.Locale(locale);
    const language = new Intl.DisplayNames(['en'], { type: 'language' }).of(parsed.language);
    const region = parsed.region
      ? new Intl.DisplayNames(['en'], { type: 'region' }).of(parsed.region)
      : undefined;
    return region ? `${language} (${region})` : language;
  } catch {
    return locale;
  }
}

export function isRightToLeftLocale(locale?: string): boolean {
  return !!locale && /^(ar|he|fa|ur)(-|$)/i.test(locale);
}
