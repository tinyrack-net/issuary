import z from 'zod';

export class ApiError<
  STATUS extends number = number,
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
  STATUS extends number = number,
  CODE extends string = string,
  MESSAGE extends string = string,
>(
  status: STATUS,
  code: CODE,
  message: MESSAGE,
) => {
  return {
    Status: status,
    Error: class extends ApiError<STATUS, CODE, MESSAGE> {
      public constructor() {
        super(status, code, message);
      }
    },
    Schema: z.object({
      code: z.literal<CODE>(code),
      message: z.literal<MESSAGE>(message),
    }),
  };
};

const createErrorWithData = <
  STATUS extends number = number,
  CODE extends string = string,
  MESSAGE extends string = string,
  DATA_SCHEMA extends z.ZodTypeAny = z.ZodTypeAny,
>(
  status: STATUS,
  code: CODE,
  message: MESSAGE,
  dataSchema: DATA_SCHEMA,
) => {
  return {
    Status: status,
    Error: class extends ApiError<STATUS, CODE, MESSAGE> {
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
      code: z.literal<CODE>(code),
      message: z.literal<MESSAGE>(message),
      data: dataSchema,
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
};
