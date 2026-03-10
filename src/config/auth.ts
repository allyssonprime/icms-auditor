/**
 * Configuração da API Gescomex para autenticação (OAuth2).
 * Valores lidos de variáveis de ambiente (.env) com prefixo VITE_.
 *
 * Configure em .env (copie de .env.example):
 *   VITE_GESCOMEX_API_HOST, VITE_GESCOMEX_API_KEY, VITE_GESCOMEX_API_SECRET
 */
export interface ApiDefaultConfig {
  host: string;
  key: string;
  secret: string;
}

function getEnv(key: keyof ImportMetaEnv, fallback: string): string {
  const v = import.meta.env[key];
  return typeof v === 'string' && v.length > 0 ? v : fallback;
}

/** Configuração da API para login (host + credenciais OAuth2 do client). */
export function getApiDefault(): ApiDefaultConfig {
  return {
    host: getEnv('VITE_GESCOMEX_API_HOST', 'https://api.gescomex.com.br'),
    key: getEnv('VITE_GESCOMEX_API_KEY', 'gescomexclient'),
    secret: getEnv('VITE_GESCOMEX_API_SECRET', 'gescomexclient'),
  };
}
