/**
 * Outcome-tracking domain types (outcome-tracking task 1.1)
 */
export interface KeyResult {
    id: string;
    okr_id: string;
    description: string;
    target: number;
    current: number;
    unit: string;
    direction: "up" | "down";
    updated_at: string;
}
export interface OKR {
    id: string;
    project_key: string;
    objective: string;
    key_results: KeyResult[];
    epic_keys: string[];
    start_date: string;
    end_date: string;
    created_at: string;
}
export interface MetricEvent {
    id: string;
    okr_id: string;
    kr_id: string | null;
    source: "launch_darkly" | "webhook";
    metric_name: string;
    value: number;
    occurred_at: string;
}
export interface OKRDelta {
    kr_id: string;
    description: string;
    previous: number;
    current: number;
    target: number;
    delta_pct: number;
}
export interface FlagAdoption {
    flag_key: string;
    /** time-series of (date, pct_enabled) */
    series: {
        date: string;
        pct: number;
    }[];
}
export interface OutcomeSnapshot {
    id: string;
    project_key: string;
    generated_at: string;
    okr_deltas: OKRDelta[];
    flag_adoptions: FlagAdoption[];
    reflection: string | null;
    notes: string | null;
}
