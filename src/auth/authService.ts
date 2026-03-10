import { getApiDefault } from '@/config/auth';
import type {
  TokenResponse,
  CredentialResponse,
  RecoveryPasswordRequest,
  RecoveryVerifyCodeRequest,
  RecoveryChangePasswordRequest,
  ApiCodeResponse,
} from './types';

const api = getApiDefault();

function basicAuthHeader(): string {
  const encoded = btoa(`${api.key}:${api.secret}`);
  return `Basic ${encoded}`;
}

/**
 * Login: POST /oauth/token (grant_type=password) e em seguida GET /credential.
 * Retorna { accessToken, user } ou lança em caso de erro.
 */
export async function loginWithPassword(
  username: string,
  password: string
): Promise<{ accessToken: string; user: CredentialResponse }> {
  const params = new URLSearchParams();
  params.append('grant_type', 'password');
  params.append('username', username.trim());
  params.append('password', password);

  const tokenRes = await fetch(`${api.host}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: basicAuthHeader(),
    },
    body: params.toString(),
  });

  if (!tokenRes.ok) {
    if (tokenRes.status === 400) {
      throw new Error('Seu Usuário e/ou Senha estão incorretos.');
    }
    const text = await tokenRes.text();
    throw new Error(text || `Erro ${tokenRes.status} ao autenticar.`);
  }

  const tokenData: TokenResponse = await tokenRes.json();
  const accessToken = tokenData.access_token;

  const credRes = await fetch(`${api.host}/credential`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!credRes.ok) {
    throw new Error('Não foi possível buscar as credenciais do usuário autenticado.');
  }

  const user: CredentialResponse = await credRes.json();
  return { accessToken, user };
}

/**
 * Recuperação de senha - passo 1: envia email para receber código.
 * POST /credential/recovery/password { email }
 */
export async function recoverySendEmail(email: string): Promise<ApiCodeResponse> {
  const res = await fetch(`${api.host}/credential/recovery/password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim() } as RecoveryPasswordRequest),
  });
  const data: ApiCodeResponse = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { message?: string }).message || 'Erro ao solicitar recuperação de senha.');
  }
  return data;
}

/**
 * Recuperação de senha - passo 2: valida código recebido por email.
 * POST /credential/recovery/verifyCode { pin }
 */
export async function recoveryVerifyCode(pin: string): Promise<ApiCodeResponse> {
  const res = await fetch(`${api.host}/credential/recovery/verifyCode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: pin.trim() } as RecoveryVerifyCodeRequest),
  });
  const data: ApiCodeResponse = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { message?: string }).message || 'Código inválido ou expirado.');
  }
  return data;
}

/**
 * Recuperação de senha - passo 3: define nova senha com o código.
 * POST /credential/recovery/changePassword { pin, newPassword, newPasswordConfirm }
 */
export async function recoveryChangePassword(
  pin: string,
  newPassword: string,
  newPasswordConfirm: string
): Promise<void> {
  const body: RecoveryChangePasswordRequest = {
    pin: pin.trim(),
    newPassword,
    newPasswordConfirm,
  };
  const res = await fetch(`${api.host}/credential/recovery/changePassword`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { message?: string }).message || 'Erro ao redefinir senha.');
  }
}
