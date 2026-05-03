import { useEffect, useRef } from "react";
import { useSettingsStore } from "../stores/settingsStore.js";
import { useLogStore } from "../stores/logStore.js";

export function useMetricsStream() {
  const { serverUrl } = useSettingsStore();
  const append = useLogStore(s => s.append);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const base = serverUrl.replace(/\/$/, "");
    const url = `${base}/api/metrics`;

    function connect() {
      const es = new EventSource(url);
      esRef.current = es;

      es.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          append({
            level: msg.level ?? "info",
            message: msg.message ?? e.data,
            metadata: msg,
            timestamp: msg.timestamp ?? new Date().toISOString(),
          });
        } catch {
          append({ level: "info", message: e.data, timestamp: new Date().toISOString() });
        }
      };

      es.onerror = () => {
        es.close();
        // Auto-reconnect after 3s
        setTimeout(connect, 3000);
      };
    }

    connect();
    return () => { esRef.current?.close(); };
  }, [serverUrl, append]);
}
