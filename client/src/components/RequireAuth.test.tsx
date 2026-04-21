import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RequireAuth } from "./RequireAuth";

vi.mock("../lib/authStore", () => ({
  getAccessToken: vi.fn(),
}));

const { getAccessToken } = await import("../lib/authStore");
const mockGetAccessToken = getAccessToken as ReturnType<typeof vi.fn>;

function renderWithRouter(initialPath = "/protected") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<RequireAuth />}>
          <Route path="/protected" element={<div>protected content</div>} />
        </Route>
        <Route path="/login" element={<div>login page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("RequireAuth", () => {
  it("redirects to /login when there is no access token", () => {
    mockGetAccessToken.mockReturnValue(null);
    renderWithRouter();
    expect(screen.getByText("login page")).toBeInTheDocument();
    expect(screen.queryByText("protected content")).not.toBeInTheDocument();
  });

  it("renders the outlet when an access token is present", () => {
    mockGetAccessToken.mockReturnValue("valid-token");
    renderWithRouter();
    expect(screen.getByText("protected content")).toBeInTheDocument();
    expect(screen.queryByText("login page")).not.toBeInTheDocument();
  });
});
