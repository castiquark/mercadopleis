import type { Language } from './translations';

/** The visitor's explicit language choice (switcher or suggestion bar); never used to redirect. */
export const LANG_CHOICE_KEY = 'mercadopleis_lang_choice';

export function rememberLanguageChoice(lang: Language) {
  try {
    localStorage.setItem(LANG_CHOICE_KEY, lang);
  } catch {
    // Ignore storage errors
  }
}

export function readLanguageChoice(): Language | null {
  try {
    const v = localStorage.getItem(LANG_CHOICE_KEY);
    return v === 'es' || v === 'en' || v === 'pt' ? v : null;
  } catch {
    return null;
  }
}
