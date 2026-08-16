import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { themeStorageKey } from "@hull/config";
import { AppErrorBoundary, BrandGate, Toaster, useBrand } from "@hull/ui";
import { SessionProvider } from "./lib/session";
import { App } from "./App";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

function Themed({ children }: { children: React.ReactNode }) {
  const { brand } = useBrand();
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey={themeStorageKey(brand)}>
      {children}
    </ThemeProvider>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("#root missing");

createRoot(root).render(
  <StrictMode>
    <BrandGate>
      <Themed>
        <QueryClientProvider client={queryClient}>
          <AppErrorBoundary>
            <SessionProvider>
              <App />
            </SessionProvider>
          </AppErrorBoundary>
          <Toaster />
        </QueryClientProvider>
      </Themed>
    </BrandGate>
  </StrictMode>,
);
