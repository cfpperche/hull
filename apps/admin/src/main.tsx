import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppErrorBoundary, Toaster } from "@hull/ui";
import { SessionProvider } from "./lib/session";
import { App } from "./App";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

const root = document.getElementById("root");
if (!root) throw new Error("#root missing");

createRoot(root).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="hull-admin-theme">
      <QueryClientProvider client={queryClient}>
        <AppErrorBoundary>
          <SessionProvider>
            <App />
          </SessionProvider>
        </AppErrorBoundary>
        <Toaster />
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);
