import { Routes, Route, Navigate } from "react-router-dom";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { useLocation } from "react-router-dom";
import { Suspense, lazy } from "react";

const pageVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  enter:   { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 340, damping: 28 } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.15 } },
};

// Lazy-load all panels
const IngestionPanel  = lazy(() => import("../../panels/IngestionPanel.js"));
const AnalysisPanel   = lazy(() => import("../../panels/AnalysisPanel.js"));
const NormaliserPanel = lazy(() => import("../../panels/NormaliserPanel.js"));
const EvidencePanel   = lazy(() => import("../../panels/EvidencePanel.js"));
const DraftPanel      = lazy(() => import("../../panels/DraftPanel.js"));
const PlanningPanel   = lazy(() => import("../../panels/PlanningPanel.js"));
const RepoPanel       = lazy(() => import("../../panels/RepoPanel.js"));
const KBPanel         = lazy(() => import("../../panels/KBPanel.js"));
const LLMPanel        = lazy(() => import("../../panels/LLMPanel.js"));
const RAGPanel        = lazy(() => import("../../panels/RAGPanel.js"));
const EvalPanel       = lazy(() => import("../../panels/EvalPanel.js"));
const ForgePanel      = lazy(() => import("../../panels/ForgePanel.js"));
const LogConsole      = lazy(() => import("../../panels/LogConsole.js"));
const TestRunnerPanel = lazy(() => import("../../panels/TestRunnerPanel.js"));
const SettingsPanel   = lazy(() => import("../../panels/SettingsPanel.js"));
const DevToolsPanel   = lazy(() => import("../../panels/DevToolsPanel.js"));

// New panels — agent orchestration
const ConnectionsPanel          = lazy(() => import("../../panels/ConnectionsPanel.js"));
const WorkflowPanel             = lazy(() => import("../../panels/WorkflowPanel.js"));
const AgentActivityPanel        = lazy(() => import("../../panels/AgentActivityPanel.js"));
const DecisionReviewPanel       = lazy(() => import("../../panels/DecisionReviewPanel.js"));
const OrchestratorFindingsPanel = lazy(() => import("../../panels/OrchestratorFindingsPanel.js"));
const SprintHealthPanel         = lazy(() => import("../../panels/SprintHealthPanel.js"));
const RoadmapPanel              = lazy(() => import("../../panels/RoadmapPanel.js"));
const DiscoveryPanel            = lazy(() => import("../../panels/DiscoveryPanel.js"));
const OutcomePanel              = lazy(() => import("../../panels/OutcomePanel.js"));
const PortfolioPanel            = lazy(() => import("../../panels/PortfolioPanel.js"));
const PRDPanel                  = lazy(() => import("../../panels/PRDPanel.js"));

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="enter"
      exit="exit"
      style={{ flex: 1, overflow: "auto", padding: 24 }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 1120,
          margin: "0 auto",
        }}
      >
        {children}
      </div>
    </motion.div>
  );
}

function Loader() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-secondary)", fontSize: 13 }}>
      Loading…
    </div>
  );
}

export function MainContent() {
  const location = useLocation();
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <AnimatePresence mode="wait">
        <Suspense fallback={<Loader />}>
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<Navigate to="/ingestion" replace />} />
            <Route path="/ingestion"  element={<PageShell><IngestionPanel /></PageShell>} />
            <Route path="/analysis"   element={<PageShell><AnalysisPanel /></PageShell>} />
            <Route path="/normaliser" element={<PageShell><NormaliserPanel /></PageShell>} />
            <Route path="/evidence"   element={<PageShell><EvidencePanel /></PageShell>} />
            <Route path="/draft"      element={<PageShell><DraftPanel /></PageShell>} />
            <Route path="/planning"   element={<PageShell><PlanningPanel /></PageShell>} />
            <Route path="/repo"       element={<PageShell><RepoPanel /></PageShell>} />
            <Route path="/kb"         element={<PageShell><KBPanel /></PageShell>} />
            <Route path="/llm"        element={<PageShell><LLMPanel /></PageShell>} />
            <Route path="/rag"        element={<PageShell><RAGPanel /></PageShell>} />
            <Route path="/eval"       element={<PageShell><EvalPanel /></PageShell>} />
            <Route path="/forge"      element={<PageShell><ForgePanel /></PageShell>} />
            <Route path="/logs"       element={<PageShell><LogConsole /></PageShell>} />
            <Route path="/tests"      element={<PageShell><TestRunnerPanel /></PageShell>} />
            <Route path="/settings"   element={<PageShell><SettingsPanel /></PageShell>} />
            <Route path="/devtools"   element={<PageShell><DevToolsPanel /></PageShell>} />

            {/* Connections */}
            <Route path="/connections"           element={<Navigate to="/connections/jira" replace />} />
            <Route path="/connections/:provider" element={<PageShell><ConnectionsPanel /></PageShell>} />

            {/* Workflows */}
            <Route path="/workflows"          element={<Navigate to="/workflows/pipeline" replace />} />
            <Route path="/workflows/:tab"     element={<PageShell><WorkflowPanel /></PageShell>} />

            {/* Agents */}
            <Route path="/agents/activity"    element={<PageShell><AgentActivityPanel /></PageShell>} />
            <Route path="/agents/decisions"   element={<PageShell><DecisionReviewPanel /></PageShell>} />
            <Route path="/agents/orchestrator" element={<PageShell><OrchestratorFindingsPanel /></PageShell>} />

            {/* Sprint */}
            <Route path="/sprint/health" element={<PageShell><SprintHealthPanel /></PageShell>} />

            {/* Product */}
            <Route path="/roadmap"   element={<PageShell><RoadmapPanel /></PageShell>} />
            <Route path="/discovery" element={<PageShell><DiscoveryPanel /></PageShell>} />
            <Route path="/outcomes"  element={<PageShell><OutcomePanel /></PageShell>} />
            <Route path="/portfolio" element={<PageShell><PortfolioPanel /></PageShell>} />
            <Route path="/prd"       element={<PageShell><PRDPanel /></PageShell>} />
          </Routes>
        </Suspense>
      </AnimatePresence>
    </div>
  );
}
