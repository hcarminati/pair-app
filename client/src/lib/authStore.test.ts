import { describe, it, expect, beforeEach } from "vitest";
import {
  getAccessToken,
  getRefreshToken,
  getIsPaired,
  setTokens,
  setIsPaired,
  clearTokens,
} from "./authStore";

beforeEach(() => {
  clearTokens();
});

describe("authStore — getAccessToken / getRefreshToken", () => {
  it("returns null when no token has been set", () => {
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it("returns the access token after setTokens", () => {
    setTokens("access-abc", "refresh-xyz");
    expect(getAccessToken()).toBe("access-abc");
  });

  it("returns the refresh token after setTokens", () => {
    setTokens("access-abc", "refresh-xyz");
    expect(getRefreshToken()).toBe("refresh-xyz");
  });
});

describe("authStore — setTokens", () => {
  it("persists the access token to localStorage", () => {
    setTokens("access-abc", "refresh-xyz");
    expect(localStorage.getItem("access_token")).toBe("access-abc");
  });

  it("persists the refresh token to localStorage", () => {
    setTokens("access-abc", "refresh-xyz");
    expect(localStorage.getItem("refresh_token")).toBe("refresh-xyz");
  });

  it("overwrites a previously stored token", () => {
    setTokens("first", "first-refresh");
    setTokens("second", "second-refresh");
    expect(getAccessToken()).toBe("second");
    expect(localStorage.getItem("access_token")).toBe("second");
  });
});

describe("authStore — setIsPaired / getIsPaired", () => {
  it("returns false by default", () => {
    expect(getIsPaired()).toBe(false);
  });

  it("returns true after setIsPaired(true)", () => {
    setIsPaired(true);
    expect(getIsPaired()).toBe(true);
  });

  it("returns false after setIsPaired(false)", () => {
    setIsPaired(true);
    setIsPaired(false);
    expect(getIsPaired()).toBe(false);
  });

  it("persists true to localStorage as the string 'true'", () => {
    setIsPaired(true);
    expect(localStorage.getItem("is_paired")).toBe("true");
  });

  it("persists false to localStorage as the string 'false'", () => {
    setIsPaired(true);
    setIsPaired(false);
    expect(localStorage.getItem("is_paired")).toBe("false");
  });
});

describe("authStore — clearTokens", () => {
  it("resets access and refresh tokens to null", () => {
    setTokens("access-abc", "refresh-xyz");
    clearTokens();
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it("resets isPaired to false", () => {
    setIsPaired(true);
    clearTokens();
    expect(getIsPaired()).toBe(false);
  });

  it("removes all three keys from localStorage", () => {
    setTokens("access-abc", "refresh-xyz");
    setIsPaired(true);
    clearTokens();
    expect(localStorage.getItem("access_token")).toBeNull();
    expect(localStorage.getItem("refresh_token")).toBeNull();
    expect(localStorage.getItem("is_paired")).toBeNull();
  });
});
