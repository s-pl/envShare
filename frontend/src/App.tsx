import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { LogoMark } from "./components/brand/Logo";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { PrivacyPage } from "./pages/PrivacyPage";
import { useAuthStore } from "./store/authStore";

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function SessionRestoring() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 text-muted-foreground">
        <div className="relative">
          <LogoMark size={48} animated />
          <span className="absolute -bottom-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-foreground/40 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-foreground/60" />
          </span>
        </div>
        <p className="text-sm font-medium">Restoring session…</p>
      </div>
    </div>
  );
}

export default function App() {
  const { isRestoring, restoreSession } = useAuthStore();

  useEffect(() => {
    restoreSession();
  }, []);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route
        path="/*"
        element={
          isRestoring ? (
            <SessionRestoring />
          ) : (
            <PrivateRoute>
              <DashboardPage />
            </PrivateRoute>
          )
        }
      />
    </Routes>
  );
}
