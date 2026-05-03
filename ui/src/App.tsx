import { HashRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "./components/layout/ThemeProvider.js";
import { TitleBar } from "./components/layout/TitleBar.js";
import { Sidebar } from "./components/layout/Sidebar.js";
import { MainContent } from "./components/layout/MainContent.js";
import { GlassToastStack } from "./components/glass/GlassToast.js";
import "./theme/tokens.css";
import "./theme/glass.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, staleTime: 30_000 },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <HashRouter>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              height: "100vh",
              overflow: "hidden",
              background: "var(--bg-base)",
              color: "var(--text-primary)",
            }}
          >
            <TitleBar />
            <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
              <Sidebar />
              <MainContent />
            </div>
          </div>
          <GlassToastStack />
        </HashRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
