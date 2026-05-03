// Structured logger for adapter calls and analysis runs

export type LogLevel = "info" | "warn" | "error" | "debug";

export interface LogEntry {
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  timestamp: string;
}

function log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  const entry: LogEntry = {
    level,
    message,
    context,
    timestamp: new Date().toISOString(),
  };
  // Write structured JSON to stdout (info/debug) or stderr (warn/error)
  const line = JSON.stringify(entry);
  if (level === "warn" || level === "error") {
    process.stderr.write(line + "\n");
  } else {
    process.stdout.write(line + "\n");
  }
}

export const logger = {
  info: (message: string, context?: Record<string, unknown>) => log("info", message, context),
  warn: (message: string, context?: Record<string, unknown>) => log("warn", message, context),
  error: (message: string, context?: Record<string, unknown>) => log("error", message, context),
  debug: (message: string, context?: Record<string, unknown>) => log("debug", message, context),

  /** Emit a structured adapter-call trace entry */
  adapterCall(params: {
    adapter: string;
    operation: string;
    statusCode?: number;
    latencyMs: number;
    retryCount: number;
    error?: string;
    degraded?: boolean;
  }): void {
    log("info", "adapter_call", params);
  },
};
