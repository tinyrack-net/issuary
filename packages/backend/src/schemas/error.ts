import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { z } from 'zod';

export class TinyAuthError<
  STATUS extends ContentfulStatusCode = ContentfulStatusCode,
  CODE extends string = string,
  MESSAGE extends string = string,
> extends Error {
  public readonly status: STATUS;
  public readonly code: CODE;
  public override readonly message: MESSAGE;

  public constructor(status: STATUS, code: CODE, message: MESSAGE) {
    super(message);
    this.status = status;
    this.code = code;
    this.message = message;
  }

  public toJson() {
    return {
      code: this.code,
      message: this.message,
    };
  }
}

const createError = <
  STATUS extends ContentfulStatusCode = ContentfulStatusCode,
  CODE extends string = string,
  MESSAGE extends string = string,
>(
  status: STATUS,
  code: CODE,
  message: MESSAGE,
) => {
  return {
    Status: status,
    Error: class extends TinyAuthError<STATUS, CODE, MESSAGE> {
      public constructor() {
        super(status, code, message);
      }
    },
    Schema: z.object({
      code: z.literal(code).describe('Machine-readable error code'),
      message: z.literal(message).describe('Human-readable error message'),
    }),
  };
};

const createErrorWithData = <
  STATUS extends ContentfulStatusCode = ContentfulStatusCode,
  CODE extends string = string,
  MESSAGE extends string = string,
  DATA_SCHEMA extends z.ZodType = z.ZodType,
>(
  status: STATUS,
  code: CODE,
  message: MESSAGE,
  dataSchema: DATA_SCHEMA,
) => {
  return {
    Status: status,
    Error: class extends TinyAuthError<STATUS, CODE, MESSAGE> {
      public data: z.infer<DATA_SCHEMA>;

      public constructor(data: z.infer<DATA_SCHEMA>) {
        super(status, code, message);
        this.data = data;
      }

      public override toJson() {
        return {
          ...super.toJson(),
          data: this.data,
        };
      }
    },
    Schema: z.object({
      code: z.literal(code).describe('Machine-readable error code'),
      message: z.literal(message).describe('Human-readable error message'),
      data: dataSchema.describe('Additional error context'),
    }),
  };
};

export const e = {
  InvalidEmailOrPassword: createError(
    401,
    'INVALID_EMAIL_OR_PASSWORD',
    'The provided email or password is incorrect.',
  ),
  EmailAlreadyExists: createError(
    409,
    'EMAIL_ALREADY_EXISTS',
    'The provided email is already registered.',
  ),
  RegistrationDisabled: createError(
    403,
    'REGISTRATION_DISABLED',
    'Public registration is disabled.',
  ),
  RegistrationEmailNotAllowed: createError(
    403,
    'REGISTRATION_EMAIL_NOT_ALLOWED',
    'This email address is not allowed for registration.',
  ),
  ValidationError: createErrorWithData(
    400,
    'VALIDATION_ERROR',
    'The provided data is invalid.',
    z.string(),
  ),
  InternalServerError: createError(
    500,
    'INTERNAL_SERVER_ERROR',
    'An unexpected error occurred.',
  ),
  InvalidVerificationToken: createError(
    400,
    'INVALID_VERIFICATION_TOKEN',
    'The verification token is invalid or has expired.',
  ),
  EmailNotActivated: createError(
    403,
    'EMAIL_NOT_ACTIVATED',
    'The email service not activated.',
  ),
  EmailAlreadyVerified: createError(
    400,
    'EMAIL_ALREADY_VERIFIED',
    'The email address is already verified.',
  ),
  UserNotFound: createError(404, 'USER_NOT_FOUND', 'User not found.'),

  // OAuth errors
  OAuthClientNotFound: createError(
    400,
    'OAUTH_CLIENT_NOT_FOUND',
    'The OAuth client was not found.',
  ),
  OAuthClientDisabled: createError(
    400,
    'OAUTH_CLIENT_DISABLED',
    'The OAuth client is disabled.',
  ),
  InvalidRedirectUri: createError(
    400,
    'INVALID_REDIRECT_URI',
    'The redirect URI is not registered for this client.',
  ),
  UnsupportedResponseType: createError(
    400,
    'UNSUPPORTED_RESPONSE_TYPE',
    'The response type is not supported for this client.',
  ),
  InvalidScope: createErrorWithData(
    400,
    'INVALID_SCOPE',
    'One or more requested scopes are invalid.',
    z.object({
      invalidScopes: z.array(z.string()),
    }),
  ),
  InvalidCodeChallengeMethod: createError(
    400,
    'INVALID_CODE_CHALLENGE_METHOD',
    'The code challenge method must be S256 or plain.',
  ),
  OAuthServerError: createError(
    500,
    'OAUTH_SERVER_ERROR',
    'An unexpected error occurred during OAuth authorization.',
  ),

  // OAuth Token Endpoint Errors (RFC 6749)
  // invalid_request errors (400)
  MissingAuthorizationCode: createError(
    400,
    'MISSING_AUTHORIZATION_CODE',
    'Missing authorization code.',
  ),
  MissingRedirectUri: createError(
    400,
    'MISSING_REDIRECT_URI',
    'Missing redirect_uri.',
  ),
  MissingCodeVerifier: createError(
    400,
    'MISSING_CODE_VERIFIER',
    'Missing code_verifier for PKCE.',
  ),
  MissingRefreshToken: createError(
    400,
    'MISSING_REFRESH_TOKEN',
    'Missing refresh_token.',
  ),

  // invalid_grant errors (400)
  InvalidAuthorizationCode: createError(
    400,
    'INVALID_AUTHORIZATION_CODE',
    'Invalid or expired authorization code.',
  ),
  RedirectUriMismatch: createError(
    400,
    'REDIRECT_URI_MISMATCH',
    'Redirect URI mismatch.',
  ),
  InvalidPKCEVerifier: createError(
    400,
    'INVALID_PKCE_VERIFIER',
    'Invalid PKCE code_verifier.',
  ),
  InvalidRefreshToken: createError(
    400,
    'INVALID_REFRESH_TOKEN',
    'Invalid or expired refresh token.',
  ),
  ClientIdMismatch: createError(
    400,
    'CLIENT_ID_MISMATCH',
    'Client ID mismatch.',
  ),

  // invalid_client errors (401)
  InvalidClientCredentials: createError(
    401,
    'INVALID_CLIENT_CREDENTIALS',
    'Invalid client credentials.',
  ),

  // unsupported_grant_type errors (400)
  UnsupportedGrantType: createError(
    400,
    'UNSUPPORTED_GRANT_TYPE',
    'Grant type is not supported.',
  ),

  // JWT Token Errors
  InvalidAccessToken: createError(
    401,
    'INVALID_ACCESS_TOKEN',
    'Invalid or expired access token.',
  ),
  InvalidIdToken: createError(
    401,
    'INVALID_ID_TOKEN',
    'Invalid or expired ID token.',
  ),

  // Bearer Token Authorization Errors
  MissingAuthorizationHeader: createError(
    401,
    'MISSING_AUTHORIZATION_HEADER',
    'Missing Authorization header.',
  ),
  InvalidAuthorizationHeaderFormat: createError(
    401,
    'INVALID_AUTHORIZATION_HEADER_FORMAT',
    'Invalid Authorization header format. Expected: Bearer <token>',
  ),
  MissingBearerToken: createError(
    401,
    'MISSING_BEARER_TOKEN',
    'Missing token in Authorization header.',
  ),

  // PKCE Errors (RFC 7636)
  InvalidCodeVerifierLength: createError(
    400,
    'INVALID_CODE_VERIFIER_LENGTH',
    'Code verifier length must be between 43 and 128 characters.',
  ),

  // Token Introspection Errors (RFC 7662)
  MissingToken: createError(400, 'MISSING_TOKEN', 'Missing token parameter.'),

  // Consent Errors (OIDC Core 1.0)
  ConsentRequired: createError(
    400,
    'consent_required',
    'The Authorization Server requires End-User consent.',
  ),
  LoginRequired: createError(
    400,
    'login_required',
    'The Authorization Server requires End-User authentication.',
  ),
  AccessDenied: createError(
    400,
    'access_denied',
    'The resource owner or authorization server denied the request.',
  ),
  InteractionRequired: createError(
    400,
    'interaction_required',
    'The Authorization Server requires End-User interaction.',
  ),

  // Password Reset Errors
  InvalidPasswordResetToken: createError(
    400,
    'INVALID_PASSWORD_RESET_TOKEN',
    'The password reset token is invalid or has expired.',
  ),
  UserNotEditable: createError(
    403,
    'USER_NOT_EDITABLE',
    'This user account cannot be modified.',
  ),

  // OAuth Connect Errors (Social Login)
  OAuthProviderNotFound: createError(
    404,
    'OAUTH_PROVIDER_NOT_FOUND',
    'The OAuth provider is not configured or is disabled.',
  ),
  OAuthStateMismatch: createError(
    400,
    'OAUTH_STATE_MISMATCH',
    'The OAuth state parameter does not match. Please try again.',
  ),
  OAuthTokenExchangeFailed: createError(
    502,
    'OAUTH_TOKEN_EXCHANGE_FAILED',
    'Failed to exchange authorization code for tokens.',
  ),
  OAuthUserInfoFailed: createError(
    502,
    'OAUTH_USERINFO_FAILED',
    'Failed to fetch user information from OAuth provider.',
  ),
  OAuthAccountAlreadyLinked: createError(
    409,
    'OAUTH_ACCOUNT_ALREADY_LINKED',
    'This OAuth account is already linked to another user.',
  ),
  OAuthAccountNotLinked: createError(
    404,
    'OAUTH_ACCOUNT_NOT_LINKED',
    'No OAuth account is linked for this provider.',
  ),
  OAuthEmailNotVerified: createError(
    403,
    'OAUTH_EMAIL_NOT_VERIFIED',
    'The email address from the OAuth provider is not verified.',
  ),
  OAuthEmailConflict: createError(
    409,
    'OAUTH_EMAIL_CONFLICT',
    'An account with this email already exists. Please link your account instead.',
  ),
  CannotUnlinkLastAuthMethod: createError(
    400,
    'CANNOT_UNLINK_LAST_AUTH_METHOD',
    'Cannot unlink the last authentication method. You need at least one way to log in.',
  ),
  OAuthSessionExpired: createError(
    400,
    'OAUTH_SESSION_EXPIRED',
    'The OAuth session has expired. Please start the login process again.',
  ),
  OAuthInvalidRequest: createError(
    400,
    'OAUTH_INVALID_REQUEST',
    'Missing required parameters: code and state.',
  ),
  Unauthorized: createError(
    401,
    'UNAUTHORIZED',
    'You must be logged in to perform this action.',
  ),

  // Password Management Errors
  PasswordAlreadySet: createError(
    409,
    'PASSWORD_ALREADY_SET',
    'A password is already set for this account. Use password change instead.',
  ),
  PasswordNotSet: createError(
    400,
    'PASSWORD_NOT_SET',
    'No password is set for this account.',
  ),
  InvalidCurrentPassword: createError(
    401,
    'INVALID_CURRENT_PASSWORD',
    'The current password is incorrect.',
  ),
  CannotRemoveLastAuthMethod: createError(
    400,
    'CANNOT_REMOVE_LAST_AUTH_METHOD',
    'Cannot remove password. You need at least one way to log in.',
  ),
  CannotRemovePasswordWithSecondFactorOnly: createError(
    400,
    'CANNOT_REMOVE_PASSWORD_WITH_SECOND_FACTOR_ONLY',
    'Cannot remove password when 2FA (TOTP/Passkey) is set up without OAuth. Add an OAuth account first, or disable 2FA before removing password.',
  ),

  // TOTP Errors
  TotpAlreadyEnabled: createError(
    409,
    'TOTP_ALREADY_ENABLED',
    'TOTP is already enabled for this account.',
  ),
  TotpNotEnabled: createError(
    400,
    'TOTP_NOT_ENABLED',
    'TOTP is not enabled for this account.',
  ),
  TotpNotSetup: createError(
    400,
    'TOTP_NOT_SETUP',
    'TOTP setup has not been initiated. Please start setup first.',
  ),
  InvalidTotpCode: createError(
    400,
    'INVALID_TOTP_CODE',
    'The provided TOTP code is invalid.',
  ),
  TotpVerificationRequired: createError(
    401,
    'TOTP_VERIFICATION_REQUIRED',
    'TOTP verification is required to complete login.',
  ),
  TotpVerificationSessionExpired: createError(
    401,
    'TOTP_VERIFICATION_SESSION_EXPIRED',
    'TOTP verification session has expired. Please login again.',
  ),
  SecondFactorSessionExpired: createError(
    401,
    'SECOND_FACTOR_SESSION_EXPIRED',
    'Second factor authentication session has expired. Please login again.',
  ),

  // TOTP Recovery Code Errors
  InvalidRecoveryCode: createError(
    400,
    'INVALID_RECOVERY_CODE',
    'The provided recovery code is invalid.',
  ),
  NoRecoveryCodesAvailable: createError(
    400,
    'NO_RECOVERY_CODES_AVAILABLE',
    'No recovery codes are available. All codes have been used.',
  ),

  // Passkey Errors
  PasskeyNotEnabled: createError(
    400,
    'PASSKEY_NOT_ENABLED',
    'Passkey authentication is not enabled.',
  ),
  PasskeyNotFound: createError(
    404,
    'PASSKEY_NOT_FOUND',
    'The passkey was not found.',
  ),
  PasskeyAlreadyExists: createError(
    409,
    'PASSKEY_ALREADY_EXISTS',
    'This passkey is already registered.',
  ),
  PasskeyVerificationFailed: createError(
    400,
    'PASSKEY_VERIFICATION_FAILED',
    'Passkey verification failed.',
  ),
  PasskeyChallengeExpired: createError(
    400,
    'PASSKEY_CHALLENGE_EXPIRED',
    'The passkey challenge has expired. Please try again.',
  ),
  PasskeyChallengeNotFound: createError(
    400,
    'PASSKEY_CHALLENGE_NOT_FOUND',
    'No passkey challenge found. Please start the registration process again.',
  ),
  CannotRemoveLastPasskey: createError(
    400,
    'CANNOT_REMOVE_LAST_PASSKEY',
    'Cannot remove the last passkey. You need at least one way to log in.',
  ),
  CannotRemoveLastSecondFactor: createError(
    400,
    'CANNOT_REMOVE_LAST_SECOND_FACTOR',
    'Cannot remove the last second factor. At least one 2FA method is required.',
  ),
  SecondFactorNotAllowedForConfigUser: createError(
    403,
    'SECOND_FACTOR_NOT_ALLOWED_FOR_CONFIG_USER',
    'Second factor authentication is not available for config-managed users.',
  ),
  PasskeyUserMismatch: createError(
    403,
    'PASSKEY_USER_MISMATCH',
    'The passkey does not belong to the pending user.',
  ),

  // Email Verification Errors
  EmailVerificationRequired: createError(
    403,
    'EMAIL_VERIFICATION_REQUIRED',
    'Email verification is required before logging in.',
  ),

  // Account Deletion Errors
  AccountDeletionDisabled: createError(
    403,
    'ACCOUNT_DELETION_DISABLED',
    'Account deletion is not enabled.',
  ),
  AccountAlreadyDeleted: createError(
    400,
    'ACCOUNT_ALREADY_DELETED',
    'This account has already been deleted.',
  ),

  // Terms Consent Errors
  TermsConsentRequired: createError(
    403,
    'TERMS_CONSENT_REQUIRED',
    'You must agree to the terms of service before continuing.',
  ),
  TermsNotFound: createError(
    404,
    'TERMS_NOT_FOUND',
    'The specified terms were not found.',
  ),

  // Proxy Security Errors
  UntrustedProxy: createError(
    403,
    'UNTRUSTED_PROXY',
    'Request rejected: connection from untrusted source.',
  ),
};
