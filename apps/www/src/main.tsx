import { ThemeProvider } from "next-themes";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root missing");

createRoot(root).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="hull-www-theme">
      <App />
    </ThemeProvider>
  </StrictMode>,
);
