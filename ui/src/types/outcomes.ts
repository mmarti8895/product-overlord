/**
 * Outcome types (UI mirror of src/types/outcomes.ts)
 */

export interface KeyResult {
  id:         string;
  title:      string;
  target:     number;
  current:    number;
  unit:       string;
  source:     "manual" | "webhook";
  updated_at: string;
}

export interface OKR {
  id:                string;
  title:             string;
  quarter:           string;
  linked_epic_keys:  string[];
  key_results:       KeyResult[];
  created_at:        string;
  updated_at:        string;
}

export interface FlagAdoption {
  flag_key:         string;
  evaluations_7d:   number;
  on_percentage:    number;
  trend:            number[];  // 7-day daily array
}

export interface OKRDelta {
  okr_id:    string;
  kr_id:     string;
  before:    number;
  after:     number;
  delta:     number;
}

export interface OutcomeSnapshot {
  id:                 string;
  epic_key:           string;
  ship_date:          string;
  flag_adoption:      FlagAdoption[];
  okr_deltas:         OKRDelta[];
  reflection_draft:   string | null;
  reflection_notes:   string | null;
  status:             "draft" | "reviewed";
  created_at:         string;
}
