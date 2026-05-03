# Tasks: prd-generation

## 1. Types

- [x] 1.1 Create `src/types/prd.ts` with `DocumentType`, `PRDDraft`, `PRDContent`, `PRDSection`, `RAGSource` interfaces
- [x] 1.2 Define document template structures (PRD, one-pager, release-note) as constant section-heading arrays in `src/services/prd-writer.ts`

## 2. Services

- [x] 2.1 Implement `DraftStore` (`src/stores/draft-store.ts`):
  - [x] 2.1a LanceDB non-vector table `prd_drafts` — upsert, get, list by ticket key
  - [x] 2.1b `approve(id)` — sets `status = 'approved'`
  - [x] 2.1c `markPublished(id, url)` — sets `status = 'published'` + `confluence_url`
  - [x] 2.1d Version increment on new draft creation (query max version for ticket + 1)
- [x] 2.2 Implement `PRDWriter` (`src/services/prd-writer.ts`):
  - [x] 2.2a Readiness guard — reject with `400` body if `readiness_score < 0.4`
  - [x] 2.2b RAG retrieval — embed ticket summary, query LanceDB top-10 across `ticket`, `confluence`, `repo-file` source types
  - [x] 2.2c LLM structured-output call — JSON mode, one key per template section heading
  - [x] 2.2d Zero RAG results — inject `<!-- Low grounding confidence: no related documents found -->` into first section
  - [x] 2.2e Assemble and store `PRDDraft` via `DraftStore.save()`
- [x] 2.3 Implement `ConfluencePublisher` (`src/services/confluence-publisher.ts`):
  - [x] 2.3a Convert `PRDContent` sections to Confluence Storage Format (XHTML)
  - [x] 2.3b Fetch existing page by stored `confluence_url` or title pattern match; produce section diff
  - [x] 2.3c `POST /wiki/rest/api/content` (create) or `PUT .../content/{id}` (update) using `ConnectionManager.ConfluenceConfig`
  - [x] 2.3d Call `DraftStore.markPublished()` on success

## 3. API Routes

- [x] 3.1 Create `src/server/routes/prd.ts` with 7 routes (see design.md)
- [x] 3.2 Register PRD router in `src/server/app.ts`
- [x] 3.3 Enforce approval gate in `POST .../publish` handler — return `403` if `status !== 'approved'`

## 4. UI

- [x] 4.1 Create `prdStore` (Zustand) in `ui/src/stores/prdStore.ts` — drafts by ticket, active draft, section edit action
- [x] 4.2 Add React Query hooks: `usePRDDrafts(ticketKey)`, `usePRDDraft(ticketKey, id)`, `usePRDDiff(ticketKey, id)`
- [x] 4.3 Implement `PRDPanel` (`ui/src/panels/PRDPanel.tsx`):
  - [x] 4.3a **State A — No draft**: ticket key input, document type selector, "Generate Draft" button with spinner
  - [x] 4.3b **State B — Draft ready**: section editor (one `<textarea>` per section), RAG Sources collapsible sidebar with doc list + scores, "Approve" button
  - [x] 4.3c **State C — Approved**: "Preview Confluence Diff" button → opens `GlassModal` with side-by-side diff; "Publish to Confluence" button inside modal; success `GlassToast` with Confluence link
  - [x] 4.3d Version history `GlassCard` list at bottom; click to load read-only
- [x] 4.4 Register `PRDPanel` route in app shell sidebar and router
- [x] 4.5 Install `@uiw/react-md-editor` or equivalent in `ui/package.json` (evaluate; use plain textarea if bundle size is a concern)

## 5. Tests

- [x] 5.1 Unit: `DraftStore` — save, get, list, version increment, approve, markPublished
- [x] 5.2 Unit: `PRDWriter` — readiness guard (below/above threshold), template selection, RAG zero-results warning, LLM timeout returns 502
- [x] 5.3 Unit: `ConfluencePublisher` — diff with existing page, diff with no existing page (all-added), create vs update branching, credential loading
- [x] 5.4 Integration: full draft generation pipeline — mocked LLM + LanceDB RAG retrieval
- [x] 5.5 Contract: all 7 API routes — happy path, readiness guard 400, publish without approval 403, diff with/without existing page
- [x] 5.6 UI: `PRDPanel` — all three states render correctly; approve button toggles state; publish modal shows diff; version history list
