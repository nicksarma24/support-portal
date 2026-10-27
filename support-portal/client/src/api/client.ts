import axios from "axios";

// Auth is an HTTP-only cookie set by the server; JS never sees the token.
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "/api",
  withCredentials: true,
});

// If a protected call comes back 401 (expired session / deactivated), drop client auth state.
api.interceptors.response.use(
  (r) => r,
  (err) => {
    const url: string = err.config?.url ?? "";
    if (err.response?.status === 401 && !url.startsWith("/auth/")) window.dispatchEvent(new Event("auth:expired"));
    return Promise.reject(err);
  }
);

export function errorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    if (!err.response) return "Cannot reach the server. Please try again.";
    return err.response.data?.error?.message ?? "Request failed";
  }
  return "Something went wrong";
}
