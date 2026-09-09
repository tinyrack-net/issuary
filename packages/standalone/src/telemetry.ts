import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino';
import { UndiciInstrumentation } from '@opentelemetry/instrumentation-undici';
import { NodeSDK } from '@opentelemetry/sdk-node';

let telemetrySdk: NodeSDK | undefined;

export function isTelemetryEnabled(
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  const disabled = environment['OTEL_SDK_DISABLED']?.trim().toLowerCase();
  return (
    Boolean(environment['OTEL_EXPORTER_OTLP_ENDPOINT']) && disabled !== 'true'
  );
}

export function startTelemetry(): void {
  if (telemetrySdk || !isTelemetryEnabled()) return;

  telemetrySdk = new NodeSDK({
    traceExporter: new OTLPTraceExporter(),
    instrumentations: [
      new HttpInstrumentation(),
      new UndiciInstrumentation(),
      new PgInstrumentation({
        enhancedDatabaseReporting: false,
      }),
      new PinoInstrumentation(),
    ],
  });
  telemetrySdk.start();
}

export async function shutdownTelemetry(): Promise<void> {
  const sdk = telemetrySdk;
  telemetrySdk = undefined;
  if (sdk) await sdk.shutdown();
}

startTelemetry();
