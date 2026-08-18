import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { themeStorageKey } from "@hull/config";
import {
  AppErrorBoundary,
  BrandGate,
  LocaleProvider,
  Toaster,
  useAccountLocale,
  useBrand,
} from "@hull/ui";
import { SessionProvider, useSession } from "./lib/session";
import { App } from "./App";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

function Themed({ children }: { children: React.ReactNode }) {
  const { brand } = useBrand();
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey={themeStorageKey(brand)}
    >
      {children}
    </ThemeProvider>
  );
}

/**
 * The account's stored choice, handed up to the provider at the root. Signed
 * out, `me` is null and the browser's own preference stands — which is the right
 * answer for someone who does not have an account yet.
 */
function Localized({ children }: { children: React.ReactNode }) {
  const { me } = useSession();
  useAccountLocale(me?.user.locale);
  return <>{children}</>;
}

const root = document.getElementById("root");
if (!root) throw new Error("#root missing");

createRoot(root).render(
  <StrictMode>
    {/* Outermost: BrandGate and AppErrorBoundary both render text. */}
    <LocaleProvider>
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
    </LocaleProvider>
  </StrictMode>,
);
