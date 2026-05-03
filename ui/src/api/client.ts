import { useSettingsStore } from "../stores/settingsStore.js";

export interface APIError {
  status: number;
  message: string;
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: APIError };

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<Result<T>> {
  const { serverUrl, authToken } = useSettingsStore.getState();
  const base = serverUrl.replace(/\/$/, "");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  try {
    const res = await fetch(`${base}${path}`, { ...init, headers: { ...headers, ...init?.headers } });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      return { ok: false, error: { status: res.status, message: text } };
    }
    const data: T = await res.json();
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: { status: 0, message: String(e) } };
  }
}
