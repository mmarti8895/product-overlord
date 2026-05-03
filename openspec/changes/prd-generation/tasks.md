# Tasks: prd-generation

## 1. Types

- [ ] 1.1 Create `src/types/prd.ts` with `DocumentType`, `PRDDraft`, `PRDContent`, `PRDSection`, `RAGSource` interfaces
- [ ] 1.2 Define document template structures (PRD, one-pager, release-note) as constant section-heading arrays in `src/services/prd-writer.ts`

## 2. Services

- [ ] 2.1 Implement `DraftStore` (`src/stores/draft-store.ts`):
  - [ ] 2.1a LanceDB non-vector table `prd_drafts` — upsert, get, list by ticket key
  - [ ] 2.1b `approve(id)` — sets `status = 'approved'`
  - [ ] 2.1c `markPublished(id, url)` — sets `status = 'published'` + `confluence_url`
  - [ ] 2.1d Version increment on new draft creation (query max version for ticket + 1)
- [ ] 2.2 Implement `PRDWriter` (`src/services/prd-writer.ts`):
  - [ ] 2.2a Readiness guard — reject with `400` body if `readiness_score < 0.4`
  - [ ] 2.2b RAG retrieval — embed ticket summary, query LanceDB top-10 across `ticket`, `confluence`, `repo-file` source types
  - [ ] 2.2c LLM structured-output call — JSON mode, one key per template section heading
  - [ ] 2.2d Zero RAG results — inject `<!-- Low grounding confidence: no related documents found -->` into first section
  - [ ] 2.2e Assemble and store `PRDDraft` via `DraftStore.save()`
- [ ] 2.3 Implement `ConfluencePublisher` (`src/services/confluence-publisher.ts`):
  - [ ] 2.3a Convert `PRDContent` sections to Confluence Storage Format (XHTML)
  - [ ] 2.3b Fetch existing page by stored `confluence_url` or title pattern match; produce section diff
  - [ ] 2.3c `POST /wiki/rest/api/content` (create) or `PUT .../content/{id}` (update) using `ConnectionManager.ConfluenceConfig`
  - [ ] 2.3d Call `DraftStore.markPublished()` on success

## 3. API Routes

- [ ] 3.1 Create `src/server/routes/prd.ts` with 7 routes (see design.md)
- [ ] 3.2 Register PRD router in `src/server/app.ts`
- [ ] 3.3 Enforce approval gate in `POST .../publish` handler — return `403` if `status !== 'approved'`

## 4. UI

- [ ] 4.1 Create `prdStore` (Zustand) in `ui/src/stores/prdStore.ts` — drafts by ticket, active draft, section edit action
- [ ] 4.2 Add React Query hooks: `usePRDDrafts(ticketKey)`, `usePRDDraft(ticketKey, id)`, `usePRDDiff(ticketKey, id)`
- [ ] 4.3 Implement `PRDPanel` (`ui/src/panels/PRDPanel.tsx`):
  - [ ] 4.3a **State A — No draft**: ticket key input, document type selector, "Generate Draft" button with spinner
  - [ ] 4.3b **State B — Draft ready**: section editor (one `<textarea>` per section), RAG Sources collapsible sidebar with doc list + scores, "Approve" button
  - [ ] 4.3c **State C — Approved**: "Preview Confluence Diff" button → opens `GlassModal` with side-by-side diff; "Publish to Confluence" button inside modal; success `GlassToast` with Confluence link
  - [ ] 4.3d Version history `GlassCard` list at bottom; click to load read-only
- [ ] 4.4 Register `PRDPanel` route in app shell sidebar and router
- [ ] 4.5 Install `@uiw/react-md-editor` or equivalent in `ui/package.json` (evaluate; use plain textarea if bundle size is a concern)

## 5. Tests

- [ ] 5.1 Unit: `DraftStore` — save, get, list, version increment, approve, markPublished
- [ ] 5.2 Unit: `PRDWriter` — readiness guard (below/above threshold), template selection, RAG zero-results warning, LLM timeout returns 502
- [ ] 5.3 Unit: `ConfluencePublisher` — diff with existing page, diff with no existing page (all-added), create vs update branching, credential loading
- [ ] 5.4 Integration: full draft generation pipeline — mocked LLM + LanceDB RAG retrieval
- [ ] 5.5 Contract: all 7 API routes — happy path, readiness guard 400, publish without approval 403, diff with/without existing page
- [ ] 5.6 UI: `PRDPanel` — all three states render correctly; approve button toggles state; publish modal shows diff; version history list
