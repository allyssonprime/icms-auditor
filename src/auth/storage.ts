import type { CredentialResponse } from './types';

const TOKEN_KEY = 'icms_auditor_access_token';
const USER_KEY = 'icms_auditor_user';

export function getStoredToken(): string | null {
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): CredentialResponse | null {
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CredentialResponse;
  } catch {
    return null;
  }
}

export function setStoredAuth(token: string, user: CredentialResponse): void {
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearStoredAuth(): void {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}
