import { describe, expect, test } from 'vitest';
import { TinyAuthError } from './error.js';

describe('TinyAuthError.fromResponse', () => {
  test('uses the server code and message when the response body is JSON', async () => {
    const response = new Response(
      JSON.stringify({
        code: 'INVALID_TOKEN',
        message: 'The token is invalid.',
      }),
      {
        status: 400,
        statusText: 'Bad Request',
        headers: {
          'content-type': 'application/json',
        },
      },
    );

    const error = await TinyAuthError.fromResponse(response);

    expect(error).toBeInstanceOf(TinyAuthError);
    expect(error.code).toBe('INVALID_TOKEN');
    expect(error.status).toBe(400);
    expect(error.message).toBe('The token is invalid.');
  });

  test('falls back to statusText and UNKNOWN_ERROR when the body is not JSON', async () => {
    const response = new Response('gateway timed out', {
      status: 504,
      statusText: 'Gateway Timeout',
      headers: {
        'content-type': 'text/plain',
      },
    });

    const error = await TinyAuthError.fromResponse(response);

    expect(error.code).toBe('UNKNOWN_ERROR');
    expect(error.status).toBe(504);
    expect(error.message).toBe('Gateway Timeout');
  });
});
