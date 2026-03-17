import React from "react";
import ReactDOM from "react-dom/client";
import { Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import App from "./App";
import { PrivacyPage } from "./pages/PrivacyPage";
import { CookieConsent } from "./components/common/CookieConsent";
import "./index.css";

// Initialize theme from localStorage before React renders (prevents flash)
const saved = localStorage.getItem("theme");
if (
  saved === "dark" ||
  (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches)
) {
  document.documentElement.classList.add("dark");
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={import.meta.env.VITE_BASENAME || "/"}>
        {/*
         * Public routes are declared here, outside <App>, so they never
         * touch the auth-restoration logic in App.tsx.
         * <App> handles /login and all authenticated routes.
         */}
        <Routes>
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/*" element={<App />} />
        </Routes>

        <CookieConsent />

        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "hsl(var(--card))",
              color: "hsl(var(--foreground))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "calc(var(--radius) + 2px)",
              fontSize: "13px",
              boxShadow: "0 4px 12px hsl(var(--foreground) / 0.08)",
            },
            success: {
              iconTheme: {
                primary: "hsl(var(--foreground))",
                secondary: "hsl(var(--background))",
              },
            },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
