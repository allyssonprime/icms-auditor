import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { CredentialResponse } from './types';
import { getStoredToken, getStoredUser, setStoredAuth, clearStoredAuth } from './storage';
import * as authService from './authService';

type RecoveryScreen = 'email' | 'code' | 'new-password' | null;

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: CredentialResponse | null;
  accessToken: string | null;
  recoveryScreen: RecoveryScreen;
  recoveryPin: string | null;
}

interface AuthActions {
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  setRecoveryScreen: (screen: RecoveryScreen) => void;
  setRecoveryPin: (pin: string | null) => void;
  recoverySendEmail: (email: string) => Promise<void>;
  recoveryVerifyCode: (pin: string) => Promise<void>;
  recoveryChangePassword: (newPassword: string, newPasswordConfirm: string) => Promise<void>;
  clearRecoveryError: () => void;
}

interface AuthContextValue extends AuthState, AuthActions {
  recoveryError: string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<CredentialResponse | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [recoveryScreen, setRecoveryScreenState] = useState<RecoveryScreen>(null);
  const [recoveryPin, setRecoveryPinState] = useState<string | null>(null);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  useEffect(() => {
    const token = getStoredToken();
    const storedUser = getStoredUser();
    if (token && storedUser) {
      setAccessToken(token);
      setUser(storedUser);
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const { accessToken: token, user: userData } = await authService.loginWithPassword(username, password);
    setStoredAuth(token, userData);
    setAccessToken(token);
    setUser(userData);
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(() => {
    clearStoredAuth();
    setAccessToken(null);
    setUser(null);
    setIsAuthenticated(false);
    setRecoveryScreenState(null);
    setRecoveryPinState(null);
    setRecoveryError(null);
  }, []);

  const setRecoveryScreen = useCallback((screen: RecoveryScreen) => {
    setRecoveryScreenState(screen);
    setRecoveryError(null);
    if (screen !== 'new-password') setRecoveryPinState(null);
  }, []);

  const setRecoveryPin = useCallback((pin: string | null) => {
    setRecoveryPinState(pin);
  }, []);

  const recoverySendEmail = useCallback(async (email: string) => {
    setRecoveryError(null);
    try {
      await authService.recoverySendEmail(email);
      setRecoveryScreenState('code');
    } catch (e) {
      setRecoveryError(e instanceof Error ? e.message : 'Erro ao solicitar recuperação.');
      throw e;
    }
  }, []);

  const recoveryVerifyCode = useCallback(async (pin: string) => {
    setRecoveryError(null);
    try {
      await authService.recoveryVerifyCode(pin);
      setRecoveryPinState(pin);
      setRecoveryScreenState('new-password');
    } catch (e) {
      setRecoveryError(e instanceof Error ? e.message : 'Código inválido ou expirado.');
      throw e;
    }
  }, []);

  const recoveryChangePassword = useCallback(
    async (newPassword: string, newPasswordConfirm: string) => {
      setRecoveryError(null);
      if (!recoveryPin) {
        const err = new Error('Código de recuperação não encontrado.');
        setRecoveryError(err.message);
        throw err;
      }
      try {
        await authService.recoveryChangePassword(recoveryPin, newPassword, newPasswordConfirm);
        setRecoveryScreenState(null);
        setRecoveryPinState(null);
      } catch (e) {
        setRecoveryError(e instanceof Error ? e.message : 'Erro ao redefinir senha.');
        throw e;
      }
    },
    [recoveryPin]
  );

  const clearRecoveryError = useCallback(() => setRecoveryError(null), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated,
      isLoading,
      user,
      accessToken,
      recoveryScreen,
      recoveryPin,
      recoveryError: recoveryError ?? null,
      login,
      logout,
      setRecoveryScreen,
      setRecoveryPin,
      recoverySendEmail,
      recoveryVerifyCode,
      recoveryChangePassword,
      clearRecoveryError,
    }),
    [
      isAuthenticated,
      isLoading,
      user,
      accessToken,
      recoveryScreen,
      recoveryPin,
      recoveryError,
      login,
      logout,
      setRecoveryScreen,
      setRecoveryPin,
      recoverySendEmail,
      recoveryVerifyCode,
      recoveryChangePassword,
      clearRecoveryError,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
