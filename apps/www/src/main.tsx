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
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey={`${themeStorageKey(brand)}-www`}
    >
      {children}
    </ThemeProvider>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("#root missing");

createRoot(root).render(
  <StrictMode>
    {/* No session on this host, so the browser's own preference is the only rung
        below English — but BrandGate still renders text, so this sits above it. */}
    <LocaleProvider>
      <BrandGate>
        <Themed>
          <App />
        </Themed>
      </BrandGate>
    </LocaleProvider>
  </StrictMode>,
);
