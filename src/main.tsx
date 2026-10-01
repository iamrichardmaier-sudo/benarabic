import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import ErrorBoundary from "./components/ErrorBoundary.tsx";
import { initAnalytics } from "./lib/analytics";
import { initTheme } from "./lib/preferences";
import "./index.css";

// Applied before first paint so a dark-theme user never sees a light flash.
initTheme();
initAnalytics();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
