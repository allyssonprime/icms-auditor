import { useState } from 'react';
import { useAuth } from './AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function RecoveryEmailPage() {
  const { setRecoveryScreen, recoverySendEmail, recoveryError, clearRecoveryError } = useAuth();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearRecoveryError();
    const emailTrim = email.trim();
    if (!emailTrim) return;
    if (!EMAIL_REGEX.test(emailTrim)) return;
    setIsSubmitting(true);
    try {
      await recoverySendEmail(emailTrim);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-r from-[#2B318A] to-[#5A81FA] p-4">
      <Card className="w-full max-w-[420px] shadow-xl border-0 bg-white/95">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-xl">Recuperação de senha</CardTitle>
          <CardDescription>
            Informe seu email para receber um código de verificação.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {recoveryError && (
            <Alert variant="destructive">
              <AlertDescription>{recoveryError}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="recovery-email">Email</Label>
              <Input
                id="recovery-email"
                type="email"
                placeholder="Seu email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                disabled={isSubmitting}
                className="w-full"
              />
            </div>
            <Button type="submit" className="w-full bg-[#2B318A] hover:bg-[#1e2462]" disabled={isSubmitting}>
              {isSubmitting ? 'Enviando...' : 'Recuperar senha'}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground">
            <button
              type="button"
              onClick={() => setRecoveryScreen(null)}
              className="text-[#2B318A] font-medium underline underline-offset-2 hover:no-underline"
            >
              Voltar para o login
            </button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
