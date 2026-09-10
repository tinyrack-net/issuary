import { expect, test } from 'vitest';
import { requestIp } from './request-ip.js';

const env = { incoming: { socket: { remoteAddress: '10.0.0.2' } } };
test('untrusted forwarding headers cannot change the rate-limit identity', () => {
  expect(requestIp(env, '203.0.113.8', false)).toBe('10.0.0.2');
  expect(requestIp(env, 'spoof, 203.0.113.8', true)).toBe('10.0.0.2');
});
test('trust walks the forwarding chain from the actual peer', () => {
  expect(requestIp(env, '192.0.2.5, 203.0.113.8', ['10.0.0.0/8'])).toBe(
    '203.0.113.8',
  );
  expect(requestIp(env, '192.0.2.5, 203.0.113.8', 1)).toBe('203.0.113.8');
  expect(requestIp({}, '192.0.2.5', true)).toBeUndefined();
});

test('IPv6 and mixed multi-hop chains stop at the first untrusted peer', () => {
  const peer = { connInfo: { remote: { address: '::1' } } };
  expect(requestIp(peer, '192.0.2.8, 2001:db8::5', ['::1'])).toBe(
    '2001:db8::5',
  );
  expect(requestIp(peer, '192.0.2.8, 2001:db8::5', 2)).toBe('192.0.2.8');
  expect(requestIp(peer, '192.0.2.8', false)).toBe('::1');
  expect(requestIp(peer, 'unknown', true)).toBe('::1');
  expect(
    requestIp(
      { connInfo: { remote: { address: 'invalid' } } },
      '192.0.2.8',
      true,
    ),
  ).toBeUndefined();
});
