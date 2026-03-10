import { useState, useRef, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

const PIN_LENGTH = 6;

export function RecoveryCodePage() {
  const { setRecoveryScreen, recoveryVerifyCode, recoveryError, clearRecoveryError } = useAuth();
  const [pin, setPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH);
    setPin(v);
    clearRecoveryError();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearRecoveryError();
    if (pin.length !== PIN_LENGTH) return;
    setIsSubmitting(true);
    try {
      await recoveryVerifyCode(pin);
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
            Informe o código de 6 dígitos que você recebeu por email.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {recoveryError && (
            <Alert variant="destructive">
              <AlertDescription>{recoveryError}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative flex items-center justify-center gap-1 border rounded-md bg-background h-12 px-2">
              <input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                maxLength={PIN_LENGTH}
                value={pin}
                onChange={handlePinChange}
                className="absolute inset-0 w-full h-full text-center text-2xl font-mono tracking-[0.5em] opacity-0 cursor-pointer"
                aria-label="Código de verificação"
              />
              {Array.from({ length: PIN_LENGTH }, (_, i) => (
                <span
                  key={i}
                  className="w-8 h-10 flex items-center justify-center text-xl font-semibold border-b-2 border-muted-foreground/30 text-center"
                >
                  {pin[i] ?? ''}
                </span>
              ))}
            </div>
            <Button
              type="submit"
              className="w-full bg-[#2B318A] hover:bg-[#1e2462]"
              disabled={pin.length !== PIN_LENGTH || isSubmitting}
            >
              {isSubmitting ? 'Verificando...' : 'Enviar código'}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground">
            <button
              type="button"
              onClick={() => setRecoveryScreen('email')}
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
