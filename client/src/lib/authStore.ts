let accessToken: string | null = localStorage.getItem("access_token");
let refreshToken: string | null = localStorage.getItem("refresh_token");
let isPaired: boolean = localStorage.getItem("is_paired") === "true";

export function getAccessToken(): string | null {
  return accessToken;
}

export function getRefreshToken(): string | null {
  return refreshToken;
}

export function getIsPaired(): boolean {
  return isPaired;
}

export function setTokens(access: string, refresh: string): void {
  accessToken = access;
  refreshToken = refresh;
  localStorage.setItem("access_token", access);
  localStorage.setItem("refresh_token", refresh);
}

export function setIsPaired(value: boolean): void {
  isPaired = value;
  localStorage.setItem("is_paired", String(value));
}

export function clearTokens(): void {
  accessToken = null;
  refreshToken = null;
  isPaired = false;
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("is_paired");
}
