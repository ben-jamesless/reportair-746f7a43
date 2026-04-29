import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Apply theme class before React mounts to avoid a flash of the wrong theme.
(() => {
  try {
    const stored = localStorage.getItem("theme");
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    const isDark = stored ? stored === "dark" : !!prefersDark;
    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";
  } catch {
    /* no-op */
  }
})();

createRoot(document.getElementById("root")!).render(<App />);
