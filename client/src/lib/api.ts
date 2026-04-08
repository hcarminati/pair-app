import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from "./authStore";

const BASE_URL = import.meta.env["VITE_API_URL"] ?? "http://localhost:3000";

export async function apiFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> | undefined),
  };

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      const newToken = getAccessToken();
      const retryHeaders: Record<string, string> = {
        ...headers,
        ...(newToken ? { Authorization: `Bearer ${newToken}` } : {}),
      };
      return fetch(`${BASE_URL}${path}`, { ...options, headers: retryHeaders });
    }
    clearTokens();
    window.location.href = "/login";
  }

  return res;
}

export async function logout(): Promise<void> {
  await apiFetch("/auth/logout", { method: "POST" });
}

export async function refreshAccessToken(): Promise<boolean> {
  const refresh_token = getRefreshToken();
  if (!refresh_token) return false;

  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token }),
  });

  if (!res.ok) return false;

  const data = (await res.json()) as {
    session: { access_token: string; refresh_token: string };
  };
  setTokens(data.session.access_token, data.session.refresh_token);
  return true;
}
