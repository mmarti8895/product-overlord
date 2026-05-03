/**
 * PRD types (UI mirror of src/types/prd.ts)
 */

export type DocumentType = "prd" | "one-pager" | "release-note";
export type PRDStatus = "draft" | "approved" | "published";

export interface RAGSource {
  id:      string;
  title:   string;
  source:  string;
  score:   number;
  snippet: string;
}

export interface PRDSection {
  heading: string;
  content: string;
}

export interface PRDContent {
  sections: PRDSection[];
}

export interface PRDDraft {
  id:             string;
  ticket_key:     string;
  doc_type:       DocumentType;
  version:        number;
  status:         PRDStatus;
  content:        PRDContent;
  rag_sources:    RAGSource[];
  confluence_url: string | null;
  created_at:     string;
  updated_at:     string;
}

export interface PRDDiff {
  sections: Array<{
    heading: string;
    old:     string | null;
    new:     string;
    added:   boolean;
    changed: boolean;
  }>;
}
