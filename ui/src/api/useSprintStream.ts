/**
 * useSprintStream — subscribes to /api/sprint/stream SSE (task 4.2).
 *
 * - Parses sprint:snapshot-updated events and updates sprintStore
 * - Ignores sprint:heartbeat events
 * - Auto-reconnects on error with 3 s backoff
 * - Sets streamConnected flag; callers can show "Reconnecting…" badge when false
 */

import { useEffect, useRef } from "react";
import { useSettingsStore } from "../stores/settingsStore.js";
import { useSprintStore } from "../stores/sprintStore.js";
import type { SprintSnapshot } from "../types/sprint.js";

export function useSprintStream() {
  const { serverUrl } = useSettingsStore();
  const setSnapshot = useSprintStore(s => s.setSnapshot);
  const setConnected = useSprintStore(s => s.setStreamConnected);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const base = serverUrl.replace(/\/$/, "");
    const url = `${base}/api/sprint/stream`;

    function connect() {
      const es = new EventSource(url);
      esRef.current = es;

      es.addEventListener("sprint:snapshot-updated", (e: MessageEvent) => {
        try {
          const snap = JSON.parse(e.data) as SprintSnapshot;
          setSnapshot(snap.board_id, snap);
          setConnected(true);
        } catch {
          // ignore parse errors
        }
      });

      // heartbeat — just mark connected
      es.addEventListener("sprint:heartbeat", () => {
        setConnected(true);
      });

      es.onopen = () => setConnected(true);

      es.onerror = () => {
        setConnected(false);
        es.close();
        setTimeout(connect, 3000);
      };
    }

    connect();

    return () => {
      esRef.current?.close();
      setConnected(false);
    };
  }, [serverUrl, setSnapshot, setConnected]);
}
