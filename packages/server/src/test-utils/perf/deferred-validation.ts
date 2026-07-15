export type PerfResponseValidator = () => Promise<void> | void;

const responseValidators = new WeakMap<Response, PerfResponseValidator>();

export function deferPerfResponseValidation(
  response: Response,
  validate: PerfResponseValidator,
): Response {
  responseValidators.set(response, validate);
  return response;
}

export async function runDeferredPerfResponseValidation(
  response: Response,
): Promise<void> {
  const validate = responseValidators.get(response);
  responseValidators.delete(response);

  if (validate) {
    await validate();
  }
}
