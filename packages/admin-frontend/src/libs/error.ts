import { z } from 'zod';

const ErrorBodySchema = z
  .object({
    code: z.string().optional(),
    message: z.string().optional(),
  })
  .passthrough();

export class AdminApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(params: { code: string; message: string; status: number }) {
    super(params.message);
    this.name = 'AdminApiError';
    this.code = params.code;
    this.status = params.status;
  }

  static async fromResponse(response: Response): Promise<AdminApiError> {
    const fallback = {
      code: response.status === 403 ? 'forbidden' : 'request_failed',
      message: response.statusText || 'Request failed',
    };

    try {
      const parsed = ErrorBodySchema.safeParse(await response.clone().json());
      if (parsed.success) {
        return new AdminApiError({
          code: parsed.data.code ?? fallback.code,
          message: parsed.data.message ?? fallback.message,
          status: response.status,
        });
      }
    } catch {
      return new AdminApiError({ ...fallback, status: response.status });
    }

    return new AdminApiError({ ...fallback, status: response.status });
  }
}
