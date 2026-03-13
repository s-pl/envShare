import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { useAuthStore } from './store/authStore';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function SessionRestoring() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted animate-pulse">
          <KeyRound className="h-6 w-6" />
        </div>
        <p className="text-sm">Restoring session…</p>
      </div>
    </div>
  );
}

export default function App() {
  const { isRestoring, restoreSession } = useAuthStore();

  // On every page load, silently call /auth/refresh.
  // The browser sends the HttpOnly cookie automatically — no token in JS.
  // If it succeeds, the user is logged in without touching localStorage.
  useEffect(() => { restoreSession(); }, []);

  if (isRestoring) return <SessionRestoring />;

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <PrivateRoute>
            <DashboardPage />
          </PrivateRoute>
        }
      />
    </Routes>
  );
}
