import type { NarrationVoicePreference } from "~/types/narration";

export const normalizeNarrationLocale = (locale: string | null | undefined) =>
  locale
    ?.trim()
    .replace("_", "-")
    .split("-")
    .filter(Boolean)
    .map((part, index) =>
      index === 0 ? part.toLowerCase() : part.toUpperCase(),
    )
    .join("-") || null;

export const getBaseNarrationLocale = (locale: string | null | undefined) =>
  normalizeNarrationLocale(locale)?.split("-")[0] ?? null;

export const getNarrationVoicePreference = (
  voice: SpeechSynthesisVoice | null | undefined,
): NarrationVoicePreference => ({
  voiceUri: voice?.voiceURI ?? null,
  name: voice?.name ?? null,
  lang: voice?.lang ?? null,
});

export const resolveNarrationVoice = (
  voices: SpeechSynthesisVoice[],
  preference: NarrationVoicePreference,
  requestedLocale: string | null | undefined,
) => {
  if (voices.length === 0) return null;

  const normalizedRequestedLocale = normalizeNarrationLocale(requestedLocale);
  const requestedBaseLocale = getBaseNarrationLocale(normalizedRequestedLocale);
  const normalizedPreferenceLocale = normalizeNarrationLocale(preference.lang);

  const exactVoiceUri = preference.voiceUri
    ? voices.find((voice) => voice.voiceURI === preference.voiceUri)
    : null;

  if (exactVoiceUri) return exactVoiceUri;

  const nameAndExactLang =
    preference.name && normalizedPreferenceLocale
      ? voices.find(
          (voice) =>
            voice.name === preference.name &&
            normalizeNarrationLocale(voice.lang) === normalizedPreferenceLocale,
        )
      : null;

  if (nameAndExactLang) return nameAndExactLang;

  const matchingName = preference.name
    ? voices.find((voice) => voice.name === preference.name)
    : null;

  if (matchingName) return matchingName;

  const matchingFullLocale = normalizedRequestedLocale
    ? voices.find(
        (voice) =>
          normalizeNarrationLocale(voice.lang) === normalizedRequestedLocale,
      )
    : null;

  if (matchingFullLocale) return matchingFullLocale;

  const matchingBaseLocale = requestedBaseLocale
    ? voices.find(
        (voice) => getBaseNarrationLocale(voice.lang) === requestedBaseLocale,
      )
    : null;

  if (matchingBaseLocale) return matchingBaseLocale;

  const defaultVoice = voices.find((voice) => voice.default);

  return defaultVoice ?? voices[0] ?? null;
};

export const sortNarrationVoices = (
  voices: SpeechSynthesisVoice[],
  requestedLocale: string | null | undefined,
) => {
  const normalizedRequestedLocale = normalizeNarrationLocale(requestedLocale);
  const requestedBaseLocale = getBaseNarrationLocale(normalizedRequestedLocale);

  const getRank = (voice: SpeechSynthesisVoice) => {
    const voiceLocale = normalizeNarrationLocale(voice.lang);

    if (voiceLocale && voiceLocale === normalizedRequestedLocale) return 0;
    if (
      requestedBaseLocale &&
      getBaseNarrationLocale(voiceLocale) === requestedBaseLocale
    ) {
      return 1;
    }
    if (voice.default) return 2;

    return 3;
  };

  return [...voices].sort((firstVoice, secondVoice) => {
    const rankDifference = getRank(firstVoice) - getRank(secondVoice);

    if (rankDifference !== 0) return rankDifference;

    return `${firstVoice.name} ${firstVoice.lang}`.localeCompare(
      `${secondVoice.name} ${secondVoice.lang}`,
    );
  });
};

export const getNarrationVoiceLabel = (voice: SpeechSynthesisVoice) =>
  `${voice.name} - ${voice.lang}`;
