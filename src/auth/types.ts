/** Resposta do POST /oauth/token */
export interface TokenResponse {
  access_token: string;
  token_type: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
}

/** Estrutura esperada do GET /credential (dados do usuário) */
export interface CredentialResponse {
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

/** Payload para recuperação de senha (email) */
export interface RecoveryPasswordRequest {
  email: string;
}

/** Payload para verificação do código */
export interface RecoveryVerifyCodeRequest {
  pin: string;
}

/** Payload para definir nova senha */
export interface RecoveryChangePasswordRequest {
  pin: string;
  newPassword: string;
  newPasswordConfirm: string;
}

/** Resposta padrão da API Gescomex (recovery) */
export interface ApiCodeResponse {
  code: 'SUCCESS' | string;
  message?: string;
}
