import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { themeStorageKey } from "@hull/config";
import { AppErrorBoundary, BrandGate, LocaleProvider, Toaster, useBrand } from "@hull/ui";
import { SessionProvider, useSession } from "./lib/session";
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

/**
 * Inside the session, because the account's stored choice is the top rung of
 * the ladder and the session is where it arrives. Signed out, `me` is null and
 * LocaleProvider falls through to the browser's own preference — which is the
 * right answer for someone who does not have an account yet.
 */
function Localized({ children }: { children: React.ReactNode }) {
  const { me } = useSession();
  return <LocaleProvider locale={me?.user.locale}>{children}</LocaleProvider>;
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
              <Localized>
                <App />
              </Localized>
            </SessionProvider>
          </AppErrorBoundary>
          <Toaster />
        </QueryClientProvider>
      </Themed>
    </BrandGate>
  </StrictMode>,
);
