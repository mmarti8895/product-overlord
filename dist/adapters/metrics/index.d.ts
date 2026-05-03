/**
 * MetricsIngestionAdapter — interface + raw event shape (task 2.3)
 */
export interface RawMetricEvent {
    source: "launch_darkly" | "webhook";
    metric_name: string;
    value: number;
    occurred_at: number;
    flag_key?: string;
    okr_id?: string;
    kr_id?: string;
}
export interface MetricsIngestionAdapter {
    source: "launch_darkly" | "webhook";
    fetchSince(since: string | null): Promise<RawMetricEvent[]>;
}
