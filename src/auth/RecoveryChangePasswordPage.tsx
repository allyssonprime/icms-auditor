import { useState } from 'react';
import { useAuth } from './AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function RecoveryChangePasswordPage() {
  const {
    setRecoveryScreen,
    recoveryChangePassword,
    recoveryError,
    clearRecoveryError,
  } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearRecoveryError();
    if (newPassword.length < 6) {
      clearRecoveryError();
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      clearRecoveryError();
      return;
    }
    setIsSubmitting(true);
    try {
      await recoveryChangePassword(newPassword, newPasswordConfirm);
      setSuccess(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-r from-[#2B318A] to-[#5A81FA] p-4">
        <Card className="w-full max-w-[420px] shadow-xl border-0 bg-white/95">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-xl text-green-700">Senha redefinida</CardTitle>
            <CardDescription>
              Sua senha foi alterada com sucesso. Faça login com a nova senha.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              type="button"
              className="w-full bg-[#2B318A] hover:bg-[#1e2462]"
              onClick={() => setRecoveryScreen(null)}
            >
              Ir para o login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const passwordsMatch = !newPasswordConfirm || newPassword === newPasswordConfirm;
  const passwordsMismatch = newPasswordConfirm.length > 0 && newPassword !== newPasswordConfirm;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-r from-[#2B318A] to-[#5A81FA] p-4">
      <Card className="w-full max-w-[420px] shadow-xl border-0 bg-white/95">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-xl">Recuperação de senha</CardTitle>
          <CardDescription>
            Defina uma nova senha para seu usuário.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {recoveryError && (
            <Alert variant="destructive">
              <AlertDescription>{recoveryError}</AlertDescription>
            </Alert>
          )}
          {passwordsMismatch && (
            <Alert variant="destructive">
              <AlertDescription>As senhas não conferem.</AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nova senha</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="Nova senha (mín. 6 caracteres)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                disabled={isSubmitting}
                minLength={6}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password-confirm">Confirmar nova senha</Label>
              <Input
                id="new-password-confirm"
                type="password"
                placeholder="Repita a nova senha"
                value={newPasswordConfirm}
                onChange={(e) => setNewPasswordConfirm(e.target.value)}
                autoComplete="new-password"
                disabled={isSubmitting}
                minLength={6}
                className="w-full"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-[#2B318A] hover:bg-[#1e2462]"
              disabled={
                newPassword.length < 6 ||
                !passwordsMatch ||
                isSubmitting
              }
            >
              {isSubmitting ? 'Salvando...' : 'Redefinir senha'}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground">
            <button
              type="button"
              onClick={() => setRecoveryScreen('code')}
              className="text-[#2B318A] font-medium underline underline-offset-2 hover:no-underline"
            >
              Voltar
            </button>
            {' · '}
            <button
              type="button"
              onClick={() => setRecoveryScreen(null)}
              className="text-[#2B318A] font-medium underline underline-offset-2 hover:no-underline"
            >
              Login
            </button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
