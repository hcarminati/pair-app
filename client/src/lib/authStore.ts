let accessToken: string | null = null;
let refreshToken: string | null = null;
let isPaired: boolean = false;

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
}

export function setIsPaired(value: boolean): void {
  isPaired = value;
}

export function clearTokens(): void {
  accessToken = null;
  refreshToken = null;
  isPaired = false;
}
