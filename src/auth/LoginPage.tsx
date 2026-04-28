import { useState } from 'react';
import { useAuth } from './AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginPage() {
  const { login, setRecoveryScreen } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const emailTrim = email.trim();
    if (!emailTrim) {
      setError('Digite seu email.');
      return;
    }
    if (!EMAIL_REGEX.test(emailTrim)) {
      setError('Digite um endereço de email válido.');
      return;
    }
    if (!password) {
      setError('Digite sua senha.');
      return;
    }
    setIsSubmitting(true);
    try {
      await login(emailTrim, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao entrar.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="mb-8">
        <img src="/prime-logo-light-bg.png" alt="Prime Internacional" className="h-11 w-auto object-contain" />
      </div>
      <Card className="w-full max-w-[420px] shadow-sm border border-border bg-card">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-xl">Seja bem-vindo!</CardTitle>
          <CardDescription>Digite seus dados para continuar.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="email"
                placeholder="Seu email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                disabled={isSubmitting}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password">Senha</Label>
              <Input
                id="login-password"
                type="password"
                placeholder="Sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={isSubmitting}
                className="w-full"
              />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Entrando...' : 'ENTRAR'}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground">
            Você esqueceu a senha?{' '}
            <button
              type="button"
              onClick={() => setRecoveryScreen('email')}
              className="text-primary font-medium underline underline-offset-2 hover:no-underline"
            >
              Clique aqui para recuperar
            </button>
          </p>
        </CardContent>
      </Card>
      <p className="mt-6 text-xs text-muted-foreground text-center">
        © {new Date().getFullYear()} · Prime Internacional · PRIME NF-e Auditor
      </p>
    </div>
  );
}
