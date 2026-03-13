import axios, { AxiosInstance } from 'axios';

// In Docker: empty string → calls go through nginx proxy (/api/v1/...)
// In dev (vite): VITE_API_URL=http://localhost:3001
const BASE_URL = import.meta.env.VITE_API_URL ?? '';

// Access token lives ONLY in memory — never in localStorage or a cookie readable by JS.
// On page reload it's gone; App.tsx restores it by calling /auth/refresh
// (the HttpOnly refresh_token cookie is sent automatically by the browser).
let accessToken: string | null = null;

export function setToken(token: string) { accessToken = token; }
export function clearToken()            { accessToken = null; }

const axiosInstance: AxiosInstance = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  withCredentials: true,   // Always send the HttpOnly refresh_token cookie
});

axiosInstance.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

axiosInstance.interceptors.response.use(
  (res) => res.data,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        // No body needed — browser sends the HttpOnly cookie automatically
        const res = await axios.post(
          `${BASE_URL}/api/v1/auth/refresh`,
          {},
          { withCredentials: true },
        );
        accessToken = res.data.accessToken;
        original.headers.Authorization = `Bearer ${accessToken}`;
        return axiosInstance(original);
      } catch {
        // Refresh failed → session truly expired, redirect to login
        accessToken = null;
        window.location.href = '/login';
        return Promise.reject(error);
      }
    }
    return Promise.reject(new Error(error.response?.data?.error || error.message));
  },
);

export const api = {
  get:    <T>(url: string)                    : Promise<T> => axiosInstance.get(url),
  post:   <T>(url: string, data?: unknown)    : Promise<T> => axiosInstance.post(url, data),
  patch:  <T>(url: string, data?: unknown)    : Promise<T> => axiosInstance.patch(url, data),
  delete: <T>(url: string)                    : Promise<T> => axiosInstance.delete(url),
};
