import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RequireAuthAndPaired } from "./RequireAuthAndPaired";

vi.mock("../lib/authStore", () => ({
  getAccessToken: vi.fn(),
  getIsPaired: vi.fn(),
}));

const { getAccessToken, getIsPaired } = await import("../lib/authStore");
const mockGetAccessToken = getAccessToken as ReturnType<typeof vi.fn>;
const mockGetIsPaired = getIsPaired as ReturnType<typeof vi.fn>;

function renderWithRouter(initialPath = "/protected") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<RequireAuthAndPaired />}>
          <Route path="/protected" element={<div>protected content</div>} />
        </Route>
        <Route path="/login" element={<div>login page</div>} />
        <Route path="/profile" element={<div>profile page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("RequireAuthAndPaired", () => {
  it("redirects to /login when there is no access token", () => {
    mockGetAccessToken.mockReturnValue(null);
    mockGetIsPaired.mockReturnValue(false);
    renderWithRouter();
    expect(screen.getByText("login page")).toBeInTheDocument();
    expect(screen.queryByText("protected content")).not.toBeInTheDocument();
  });

  it("redirects to /profile when authenticated but not paired", () => {
    mockGetAccessToken.mockReturnValue("valid-token");
    mockGetIsPaired.mockReturnValue(false);
    renderWithRouter();
    expect(screen.getByText("profile page")).toBeInTheDocument();
    expect(screen.queryByText("protected content")).not.toBeInTheDocument();
  });

  it("renders the outlet when authenticated and paired", () => {
    mockGetAccessToken.mockReturnValue("valid-token");
    mockGetIsPaired.mockReturnValue(true);
    renderWithRouter();
    expect(screen.getByText("protected content")).toBeInTheDocument();
    expect(screen.queryByText("login page")).not.toBeInTheDocument();
    expect(screen.queryByText("profile page")).not.toBeInTheDocument();
  });
});
