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
};
