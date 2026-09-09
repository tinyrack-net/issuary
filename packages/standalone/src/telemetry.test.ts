import { describe, expect, test } from 'vitest';
import { isTelemetryEnabled } from './telemetry.js';

describe('isTelemetryEnabled', () => {
  test('requires an OTLP endpoint', () => {
    expect(isTelemetryEnabled({})).toBe(false);
  });

  test('enables telemetry when an endpoint is configured', () => {
    expect(
      isTelemetryEnabled({
        OTEL_EXPORTER_OTLP_ENDPOINT: 'http://collector:4318',
      }),
    ).toBe(true);
  });

  test('honors the standard SDK disable switch', () => {
    expect(
      isTelemetryEnabled({
        OTEL_EXPORTER_OTLP_ENDPOINT: 'http://collector:4318',
        OTEL_SDK_DISABLED: 'true',
      }),
    ).toBe(false);
  });
});
