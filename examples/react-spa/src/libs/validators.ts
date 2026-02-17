import type {
  AuthState,
  IDTokenPayload,
  IntrospectionResponse,
  JWKS,
  OpenIDConfiguration,
  TokenResponse,
  UserInfo,
} from '@/types/oidc';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function assertTokenResponse(
  value: unknown,
): asserts value is TokenResponse {
  if (
    !isRecord(value) ||
    typeof value.access_token !== 'string' ||
    typeof value.token_type !== 'string' ||
    typeof value.expires_in !== 'number'
  ) {
    throw new Error('Invalid TokenResponse');
  }
}

export function assertOpenIDConfiguration(
  value: unknown,
): asserts value is OpenIDConfiguration {
  if (
    !isRecord(value) ||
    typeof value.issuer !== 'string' ||
    typeof value.authorization_endpoint !== 'string' ||
    typeof value.token_endpoint !== 'string' ||
    typeof value.jwks_uri !== 'string' ||
    !Array.isArray(value.response_types_supported) ||
    !Array.isArray(value.subject_types_supported) ||
    !Array.isArray(value.id_token_signing_alg_values_supported)
  ) {
    throw new Error('Invalid OpenIDConfiguration');
  }
}

export function assertUserInfo(value: unknown): asserts value is UserInfo {
  if (!isRecord(value) || typeof value.sub !== 'string') {
    throw new Error('Invalid UserInfo');
  }
}

export function assertIDTokenPayload(
  value: unknown,
): asserts value is IDTokenPayload {
  if (
    !isRecord(value) ||
    typeof value.iss !== 'string' ||
    typeof value.sub !== 'string' ||
    typeof value.aud !== 'string' ||
    typeof value.exp !== 'number' ||
    typeof value.iat !== 'number'
  ) {
    throw new Error('Invalid IDTokenPayload');
  }
}

export function assertIntrospectionResponse(
  value: unknown,
): asserts value is IntrospectionResponse {
  if (!isRecord(value) || typeof value.active !== 'boolean') {
    throw new Error('Invalid IntrospectionResponse');
  }
}

export function assertJWKS(value: unknown): asserts value is JWKS {
  if (!isRecord(value) || !Array.isArray(value.keys)) {
    throw new Error('Invalid JWKS');
  }
}

export function assertAuthState(value: unknown): asserts value is AuthState {
  if (
    !isRecord(value) ||
    typeof value.state !== 'string' ||
    typeof value.code_verifier !== 'string' ||
    typeof value.nonce !== 'string'
  ) {
    throw new Error('Invalid AuthState');
  }
}
