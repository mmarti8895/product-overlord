/**
 * PRD-generation domain types (prd-generation task 1.1)
 */

export type DocumentType = "prd" | "rfc" | "brief";

export interface RAGSource {
  chunk_id:   string;
  source_url: string;
  excerpt:    string;
  score:      number;
}

export interface PRDSection {
  id:      string;
  heading: string;
  body:    string;   // Markdown
  order:   number;
}

export interface PRDContent {
  sections:    PRDSection[];
  rag_sources: RAGSource[];
}

export interface PRDDraft {
  id:             string;
  project_key:    string;
  epic_key:       string | null;
  document_type:  DocumentType;
  version:        number;
  title:          string;
  content:        PRDContent;
  status:         "draft" | "approved" | "published";
  confluence_url: string | null;
  created_at:     string;
  updated_at:     string;
}

export interface PRDDiff {
  before: string;   // previous Confluence XHTML
  after:  string;   // new XHTML
}
