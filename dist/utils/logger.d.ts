export type LogLevel = "info" | "warn" | "error" | "debug";
export interface LogEntry {
    level: LogLevel;
    message: string;
    context?: Record<string, unknown>;
    timestamp: string;
}
export declare const logger: {
    info: (message: string, context?: Record<string, unknown>) => void;
    warn: (message: string, context?: Record<string, unknown>) => void;
    error: (message: string, context?: Record<string, unknown>) => void;
    debug: (message: string, context?: Record<string, unknown>) => void;
    /** Emit a structured adapter-call trace entry */
    adapterCall(params: {
        adapter: string;
        operation: string;
        statusCode?: number;
        latencyMs: number;
        retryCount: number;
        error?: string;
        degraded?: boolean;
    }): void;
};
