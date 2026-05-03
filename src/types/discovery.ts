/**
 * Discovery types (discovery-intake task 1.1)
 */

export interface FeedbackDocument {
  id:               string;
  source:           string;          // "intercom" | "zendesk" | "webhook"
  source_id:        string;
  text:             string;
  sentiment_score:  number;          // -1..1
  created_at:       string;          // ISO
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
  dismiss_reason:      string | null;
  created_at:          string;
  updated_at:          string;
}
