import { ThemeProvider } from "next-themes";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { themeStorageKey } from "@hull/config";
import { BrandGate, LocaleProvider, useBrand } from "@hull/ui";
import { App } from "./App";
import "./index.css";

function Themed({ children }: { children: React.ReactNode }) {
  const { brand } = useBrand();
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey={`${themeStorageKey(brand)}-www`}>
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
        {/* No session on this host, so there is nothing above the browser's own
            preference to read. */}
        <LocaleProvider>
          <App />
        </LocaleProvider>
      </Themed>
    </BrandGate>
  </StrictMode>,
);
