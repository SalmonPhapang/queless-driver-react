// Port of queless_core/lib/edge/edge_telemetry.dart.
//
// The Driver app writes one row per failed edge call to the shared
// `edge_call_events` table, making edge failures queryable fleet-wide without
// any analytics SDK. The writer is fire-and-forget: telemetry can never affect
// the edge call it observes.

import type { EdgeCallAnalyticsSink, EdgeCallLog } from './edgeClient';

export interface EdgeTelemetryOptions {
  writer: (event: Record<string, unknown>) => Promise<unknown>;
  app: string;
  logSuccesses?: boolean;
}

export const edgeTelemetrySink = ({
  writer,
  app,
  logSuccesses = false,
}: EdgeTelemetryOptions): EdgeCallAnalyticsSink => {
  return (log: EdgeCallLog) => {
    if (log.success && !logSuccesses) return;

    const event: Record<string, unknown> = {
      app,
      function_name: log.functionName,
      latency_ms: log.durationMs,
      success: log.success,
      ...(log.status != null ? { status: log.status } : {}),
      ...(log.error != null ? { error: log.error } : {}),
    };

    void (async () => {
      try {
        await writer(event);
      } catch (error) {
        // Never disturb the edge call — but DO surface telemetry failures.
        console.warn(`[edge-telemetry] failed to record ${log.functionName}:`, error);
      }
    })();
  };
};
