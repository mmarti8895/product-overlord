import { HashRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "./components/layout/ThemeProvider.js";
import { TitleBar } from "./components/layout/TitleBar.js";
import { Sidebar } from "./components/layout/Sidebar.js";
import { MainContent } from "./components/layout/MainContent.js";
import { GlassToastStack } from "./components/glass/GlassToast.js";

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
          <div className="flex h-dvh flex-col overflow-hidden bg-[color:var(--bg-base)] text-[color:var(--text-primary)]">
            <TitleBar />
            <div className="flex flex-1 overflow-hidden">
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
