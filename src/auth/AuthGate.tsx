import { type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { LoginPage } from './LoginPage';
import { RecoveryEmailPage } from './RecoveryEmailPage';
import { RecoveryCodePage } from './RecoveryCodePage';
import { RecoveryChangePasswordPage } from './RecoveryChangePasswordPage';

interface AuthGateProps {
  children: ReactNode;
}

/** Exibe telas de login/recuperação quando não autenticado; caso contrário renderiza children (App). */
export function AuthGate({ children }: AuthGateProps) {
  const { isAuthenticated, isLoading, recoveryScreen } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-[#2B318A] to-[#5A81FA]">
        <div className="text-white text-lg">Carregando...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (recoveryScreen === 'email') return <RecoveryEmailPage />;
    if (recoveryScreen === 'code') return <RecoveryCodePage />;
    if (recoveryScreen === 'new-password') return <RecoveryChangePasswordPage />;
    return <LoginPage />;
  }

  return <>{children}</>;
}
