// Port of queless_core/lib/edge/edge_client.dart.
//
// Every Queless app calls Supabase edge functions (orders-status,
// paystack-settlements, driver-device-verify, ...). This helper standardizes
// the invoke call + error handling so failures surface as one exception type.

export interface EdgeCallLog {
  functionName: string;
  /** Latency in milliseconds. */
  durationMs: number;
  success: boolean;
  status?: number;
  error?: string;
}

export type EdgeCallLogger = (log: EdgeCallLog) => void;
export type EdgeCallAnalyticsSink = (log: EdgeCallLog) => void;

export class EdgeFunctionException extends Error {
  readonly status?: number;
  readonly data?: unknown;

  constructor(message: string, options: { status?: number; data?: unknown } = {}) {
    super(message);
    this.name = 'EdgeFunctionException';
    this.status = options.status;
    this.data = options.data;
  }
}

export type EdgeInvoker = (
  functionName: string,
  body: Record<string, unknown>,
  options?: { headers?: Record<string, string> },
) => Promise<unknown>;

export class EdgeClient {
  private readonly invoker: EdgeInvoker;

  /** Optional global logger for every edge-function call. */
  static logger: EdgeCallLogger | null = null;

  constructor(invoker: EdgeInvoker) {
    this.invoker = invoker;
  }

  /**
   * Install the shared default logger: prints every edge-function call
   * (`[edge] OK|FAIL <name> <ms> (status) — error`). Idempotent — safe to call
   * from every app's startup.
   */
  static installDefaultLogger(options: { forwardTo?: EdgeCallAnalyticsSink } = {}): void {
    EdgeClient.logger = (log) => {
      const marker = log.success ? 'OK' : 'FAIL';
      const status = log.status != null ? ` (${log.status})` : '';
      const error = log.error != null ? ` — ${log.error}` : '';
      // eslint-disable-next-line no-console
      console.debug(`[edge] ${marker} ${log.functionName} ${log.durationMs}ms${status}${error}`);
      const sink = options.forwardTo;
      if (sink) {
        try {
          sink(log);
        } catch {
          // Never let analytics break edge calls or the debug log.
        }
      }
    };
  }

  /** Invoke [functionName] with [body] and return the decoded response data. */
  async call(
    functionName: string,
    options: {
      body?: Record<string, unknown>;
      headers?: Record<string, string>;
    } = {},
  ): Promise<unknown> {
    const startedAt = EdgeClient.logger ? performance.now() : 0;
    try {
      const data = await this.invoker(functionName, options.body ?? {}, {
        headers: options.headers,
      });
      // Edge functions conventionally return {error: ...} on failure.
      if (data && typeof data === 'object' && !Array.isArray(data) && 'error' in data) {
        const errorValue = (data as Record<string, unknown>).error;
        if (errorValue != null) {
          throw new EdgeFunctionException(String(errorValue), { data });
        }
      }
      this.log(startedAt, functionName, true);
      return data;
    } catch (error) {
      if (error instanceof EdgeFunctionException) {
        this.log(startedAt, functionName, false, error.status, error.message);
        throw error;
      }
      this.log(startedAt, functionName, false, undefined, String(error));
      throw new EdgeFunctionException(`Edge function ${functionName} failed: ${String(error)}`);
    }
  }

  private log(
    startedAt: number,
    functionName: string,
    success: boolean,
    status?: number,
    error?: string,
  ): void {
    const logger = EdgeClient.logger;
    if (!logger) return;
    try {
      logger({
        functionName,
        durationMs: Math.round(performance.now() - startedAt),
        success,
        status,
        error,
      });
    } catch {
      // Instrumentation must never affect the call it's observing.
    }
  }
}
