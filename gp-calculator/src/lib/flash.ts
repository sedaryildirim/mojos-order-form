// A one-time message to show after a redirect ("Saved Flour"), kept in this browser tab only.
const KEY = "gp-flash";

export function setFlash(text: string): void {
  try {
    window.sessionStorage.setItem(KEY, text);
  } catch {
    // no storage: the redirect just happens without a message
  }
}

export function takeFlash(): string | null {
  try {
    const text = window.sessionStorage.getItem(KEY);
    if (text) window.sessionStorage.removeItem(KEY);
    return text;
  } catch {
    return null;
  }
}
