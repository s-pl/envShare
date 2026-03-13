import axios from 'axios';
import { create } from 'zustand';
import { setToken, clearToken } from '../api';

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

interface User { id: string; email: string; name: string; }

interface AuthState {
  isAuthenticated: boolean;
  isRestoring: boolean;   // true while we silently try to restore the session on page load
  user: User | null;
  login: (accessToken: string, user: User) => void;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  isRestoring: true,   // assume session might exist until we check
  user: null,

  login(accessToken, user) {
    setToken(accessToken);
    // refreshToken is handled as an HttpOnly cookie by the server — we never touch it
    set({ isAuthenticated: true, isRestoring: false, user });
  },

  async logout() {
    clearToken();
    // Ask server to delete the refresh token from DB and clear the cookie
    await axios.post(`${BASE_URL}/api/v1/auth/logout`, {}, { withCredentials: true }).catch(() => {});
    set({ isAuthenticated: false, isRestoring: false, user: null });
  },

  async restoreSession() {
    try {
      // Browser sends the HttpOnly refresh_token cookie automatically
      const res = await axios.post(
        `${BASE_URL}/api/v1/auth/refresh`,
        {},
        { withCredentials: true },
      );
      setToken(res.data.accessToken);
      set({ isAuthenticated: true, isRestoring: false, user: res.data.user ?? null });
    } catch {
      // No valid session — that's fine, just show the login page
      set({ isAuthenticated: false, isRestoring: false });
    }
  },
}));
