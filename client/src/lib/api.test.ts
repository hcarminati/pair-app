import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiFetch, refreshAccessToken } from "./api";
import { clearTokens, getAccessToken, setTokens } from "./authStore";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Allow window.location.href to be set without jsdom throwing
vi.stubGlobal("location", { href: "" });

function okResponse(body: unknown = {}, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function errResponse(status: number): Response {
  return new Response("{}", { status });
}

beforeEach(() => {
  clearTokens();
  vi.clearAllMocks();
  (window.location as { href: string }).href = "";
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.stubGlobal("fetch", mockFetch);
  vi.stubGlobal("location", { href: "" });
});

describe("apiFetch — request headers", () => {
  it("always sets Content-Type: application/json", async () => {
    mockFetch.mockResolvedValue(okResponse());
    await apiFetch("/test");
    const { headers } = mockFetch.mock.calls[0][1] as {
      headers: Record<string, string>;
    };
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("omits Authorization when no access token is stored", async () => {
    mockFetch.mockResolvedValue(okResponse());
    await apiFetch("/test");
    const { headers } = mockFetch.mock.calls[0][1] as {
      headers: Record<string, string>;
    };
    expect(headers).not.toHaveProperty("Authorization");
  });

  it("sets Authorization: Bearer {token} when an access token is stored", async () => {
    setTokens("my-access-token", "refresh");
    mockFetch.mockResolvedValue(okResponse());
    await apiFetch("/test");
    const { headers } = mockFetch.mock.calls[0][1] as {
      headers: Record<string, string>;
    };
    expect(headers["Authorization"]).toBe("Bearer my-access-token");
  });

  it("merges caller-supplied headers with the defaults", async () => {
    mockFetch.mockResolvedValue(okResponse());
    await apiFetch("/test", { headers: { "X-Custom": "value" } });
    const { headers } = mockFetch.mock.calls[0][1] as {
      headers: Record<string, string>;
    };
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["X-Custom"]).toBe("value");
  });

  it("prepends BASE_URL to the path", async () => {
    mockFetch.mockResolvedValue(okResponse());
    await apiFetch("/some/path");
    expect(mockFetch.mock.calls[0][0]).toBe("http://localhost:3000/some/path");
  });
});

describe("apiFetch — 401 retry flow", () => {
  it("attempts a token refresh when the server returns 401", async () => {
    setTokens("old-token", "refresh-token");
    mockFetch
      .mockResolvedValueOnce(errResponse(401))
      .mockResolvedValueOnce(
        okResponse({
          session: { access_token: "new", refresh_token: "new-r" },
        }),
      )
      .mockResolvedValueOnce(okResponse());

    await apiFetch("/protected");
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("retries the original request with the new access token after a successful refresh", async () => {
    setTokens("old-token", "refresh-token");
    mockFetch
      .mockResolvedValueOnce(errResponse(401))
      .mockResolvedValueOnce(
        okResponse({
          session: { access_token: "new-token", refresh_token: "new-r" },
        }),
      )
      .mockResolvedValueOnce(okResponse());

    await apiFetch("/protected");
    const retryHeaders = mockFetch.mock.calls[2][1].headers as Record<
      string,
      string
    >;
    expect(retryHeaders["Authorization"]).toBe("Bearer new-token");
  });

  it("clears tokens and redirects to /login when refresh fails and a token was present", async () => {
    setTokens("old-token", "refresh-token");
    mockFetch
      .mockResolvedValueOnce(errResponse(401))
      .mockResolvedValueOnce(errResponse(401));

    await apiFetch("/protected");
    expect(window.location.href).toBe("/login");
  });

  it("does not redirect when 401 is returned and no token was ever set", async () => {
    mockFetch.mockResolvedValueOnce(errResponse(401));
    await apiFetch("/protected");
    expect(window.location.href).toBe("");
  });
});

describe("refreshAccessToken", () => {
  it("returns false immediately when no refresh token is stored", async () => {
    const result = await refreshAccessToken();
    expect(result).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("calls POST /auth/refresh with the stored refresh token", async () => {
    setTokens("access", "my-refresh");
    mockFetch.mockResolvedValue(
      okResponse({ session: { access_token: "new", refresh_token: "new-r" } }),
    );
    await refreshAccessToken();
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:3000/auth/refresh");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ refresh_token: "my-refresh" }));
  });

  it("returns false when /auth/refresh responds with a non-200 status", async () => {
    setTokens("access", "my-refresh");
    mockFetch.mockResolvedValue(errResponse(401));
    expect(await refreshAccessToken()).toBe(false);
  });

  it("stores the new tokens and returns true on a successful refresh", async () => {
    setTokens("old-access", "old-refresh");
    mockFetch.mockResolvedValue(
      okResponse({
        session: { access_token: "new-access", refresh_token: "new-refresh" },
      }),
    );
    const result = await refreshAccessToken();
    expect(result).toBe(true);
    expect(getAccessToken()).toBe("new-access");
  });
});
