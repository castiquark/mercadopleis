// Cookie/analytics consent preference, stored in localStorage and broadcast to the page.

export type ConsentChoice = 'granted' | 'denied';

export const CONSENT_KEY = 'mercadopleis_cookie_consent';
export const CONSENT_EVENT = 'mercadopleis:consent-changed';
export const CONSENT_REOPEN_EVENT = 'mercadopleis:consent-reopen';

export function readConsent(): ConsentChoice | null {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === 'granted' || v === 'denied' ? v : null;
  } catch {
    return null;
  }
}

export function saveConsent(choice: ConsentChoice): void {
  try {
    localStorage.setItem(CONSENT_KEY, choice);
  } catch {
    // Storage unavailable (private mode): the choice only lasts for this page view.
  }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: choice }));
}

export function reopenConsent(): void {
  window.dispatchEvent(new Event(CONSENT_REOPEN_EVENT));
}
