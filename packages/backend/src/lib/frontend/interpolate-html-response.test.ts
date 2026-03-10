import { describe, expect, test } from 'vitest';
import { interpolateHtmlResponse } from './interpolate-html-response.js';

describe('interpolateHtmlResponse', () => {
  const variables = { TITLE: 'My App', NAME: 'Alice' };

  test('interpolates HTML response body', async () => {
    const response = new Response(
      '<html><title>{{TITLE}}</title><body>{{NAME}}</body></html>',
      { headers: { 'content-type': 'text/html; charset=utf-8' } },
    );
    const result = await interpolateHtmlResponse(response, variables);
    const body = await result.text();
    expect(body).toBe('<html><title>My App</title><body>Alice</body></html>');
  });

  test('updates content-length header', async () => {
    const response = new Response('<title>{{TITLE}}</title>', {
      headers: { 'content-type': 'text/html', 'content-length': '999' },
    });
    const result = await interpolateHtmlResponse(response, variables);
    const body = await result.text();
    const expectedLength = new TextEncoder().encode(body).byteLength;
    expect(result.headers.get('content-length')).toBe(String(expectedLength));
  });

  test('preserves status and statusText', async () => {
    const response = new Response('<p>{{TITLE}}</p>', {
      status: 201,
      statusText: 'Created',
      headers: { 'content-type': 'text/html' },
    });
    const result = await interpolateHtmlResponse(response, variables);
    expect(result.status).toBe(201);
    expect(result.statusText).toBe('Created');
  });

  test('returns non-HTML responses unchanged', async () => {
    const response = new Response('{"key": "{{TITLE}}"}', {
      headers: { 'content-type': 'application/json' },
    });
    const result = await interpolateHtmlResponse(response, variables);
    expect(result).toBe(response);
  });

  test('returns responses without content-type unchanged', async () => {
    const response = new Response('{{TITLE}}');
    const result = await interpolateHtmlResponse(response, variables);
    expect(result).toBe(response);
  });

  test('handles case-insensitive content-type check', async () => {
    const response = new Response('<p>{{TITLE}}</p>', {
      headers: { 'content-type': 'Text/HTML' },
    });
    const result = await interpolateHtmlResponse(response, variables);
    const body = await result.text();
    expect(body).toBe('<p>My App</p>');
  });
});
