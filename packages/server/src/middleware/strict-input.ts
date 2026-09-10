import { createMiddleware } from 'hono/factory';
import { e } from '../schemas/error.js';

const MAX_BODY_BYTES = 1_048_576;
const invalid = () =>
  new e.ValidationError.Error('Ambiguous or invalid request encoding');

/** JSON.parse validates syntax; the second pass retains keys discarded by JSON.parse. */
export function rejectDuplicateJsonKeys(source: string): void {
  try {
    JSON.parse(source);
  } catch {
    throw invalid();
  }
  let index = 0;
  const whitespace = () => {
    while (/\s/.test(source[index] ?? '') && index < source.length) index++;
  };
  const string = (): string => {
    const start = index++;
    while (index < source.length) {
      if (source[index] === '\\') {
        index += 2;
        continue;
      }
      if (source[index++] === '"') break;
    }
    const value: unknown = JSON.parse(source.slice(start, index));
    if (typeof value !== 'string') throw invalid();
    return value;
  };
  const value = (depth: number): void => {
    if (depth > 128) throw invalid();
    whitespace();
    const character = source[index];
    if (character === '"') {
      string();
      return;
    }
    if (character === '{') {
      index++;
      whitespace();
      const keys = new Set<string>();
      while (source[index] !== '}') {
        whitespace();
        const key = string();
        if (keys.has(key)) throw invalid();
        keys.add(key);
        whitespace();
        index++;
        value(depth + 1);
        whitespace();
        if (source[index] !== ',') break;
        index++;
      }
      index++;
      return;
    }
    if (character === '[') {
      index++;
      whitespace();
      while (source[index] !== ']') {
        value(depth + 1);
        whitespace();
        if (source[index] !== ',') break;
        index++;
      }
      index++;
      return;
    }
    while (index < source.length && !/[\s,}\]]/.test(source[index] ?? ''))
      index++;
  };
  value(0);
}

function rejectDuplicateParameters(
  parameters: URLSearchParams,
  previous = new Set<string>(),
): Set<string> {
  for (const key of parameters.keys()) {
    if (previous.has(key)) throw invalid();
    previous.add(key);
  }
  return previous;
}

export const strictInput = createMiddleware(async (c, next) => {
  const oauth =
    c.req.path.startsWith('/oauth/') || c.req.path.startsWith('/api/oauth/');
  const queryKeys = oauth
    ? rejectDuplicateParameters(new URL(c.req.url).searchParams)
    : new Set<string>();
  if (c.req.raw.body && !['GET', 'HEAD'].includes(c.req.method)) {
    const reader = c.req.raw.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const result = await reader.read();
        if (result.done) break;
        size += result.value.byteLength;
        if (size > MAX_BODY_BYTES) {
          void reader.cancel().catch(() => undefined);
          throw new e.RequestBodyTooLarge.Error();
        }
        chunks.push(result.value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const contentType = c.req
      .header('content-type')
      ?.split(';')[0]
      ?.trim()
      .toLowerCase();
    if (
      size &&
      (contentType === 'application/json' ||
        contentType === 'application/x-www-form-urlencoded')
    ) {
      let source: string;
      try {
        source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      } catch {
        throw invalid();
      }
      if (contentType === 'application/json') rejectDuplicateJsonKeys(source);
      else if (oauth)
        rejectDuplicateParameters(new URLSearchParams(source), queryKeys);
    }
    c.req.raw = new Request(c.req.raw, { body: bytes.buffer });
  }
  await next();
});
