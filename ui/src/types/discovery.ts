/**
 * Discovery types (UI mirror of src/types/discovery.ts)
 */

export interface FeedbackDocument {
  id:               string;
  source:           string;
  source_id:        string;
  text:             string;
  sentiment_score:  number;
  created_at:       string;
  customer_segment: string | null;
  tags:             string[];
  theme_id:         string | null;
}

export interface FeedbackTheme {
  id:                    string;
  name:                  string;
  document_ids:          string[];
  frequency:             number;
  avg_sentiment:         number;
  representative_quotes: string[];
  created_at:            string;
  updated_at:            string;
}

export interface OpportunityCandidate {
  id:                  string;
  theme_id:            string;
  title:               string;
  problem_statement:   string;
  estimated_reach:     number;
  estimated_impact:    number;
  status:              "pending" | "promoted" | "dismissed";
  promoted_ticket_key: string | null;
  created_at:          string;
}
