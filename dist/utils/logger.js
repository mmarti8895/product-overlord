// Structured logger for adapter calls and analysis runs
function log(level, message, context) {
    const entry = {
        level,
        message,
        context,
        timestamp: new Date().toISOString(),
    };
    // Write structured JSON to stdout (info/debug) or stderr (warn/error)
    const line = JSON.stringify(entry);
    if (level === "warn" || level === "error") {
        process.stderr.write(line + "\n");
    }
    else {
        process.stdout.write(line + "\n");
    }
}
export const logger = {
    info: (message, context) => log("info", message, context),
    warn: (message, context) => log("warn", message, context),
    error: (message, context) => log("error", message, context),
    debug: (message, context) => log("debug", message, context),
    /** Emit a structured adapter-call trace entry */
    adapterCall(params) {
        log("info", "adapter_call", params);
    },
};
