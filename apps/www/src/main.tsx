import { ThemeProvider } from "next-themes";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { themeStorageKey } from "@hull/config";
import { BrandGate, useBrand } from "@hull/ui";
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
        <App />
      </Themed>
    </BrandGate>
  </StrictMode>,
);
