import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import CoupleProfilePage from "./CoupleProfilePage";

vi.mock("../lib/api", () => ({
  apiFetch: vi.fn(),
}));

const { apiFetch } = await import("../lib/api");
const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;

function mockPairsResponse(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    json: async () => ({
      pair_id: "pair-id-1",
      about_us: "We love adventures",
      location: "Portland, OR",
      partner1: {
        display_name: "Alex",
        about_me: "Love hiking",
        location: "Portland, OR",
        tags: ["cooking", "hiking"],
      },
      partner2: {
        display_name: "Jordan",
        about_me: "Love cooking",
        location: "Seattle, WA",
        tags: ["cooking", "yoga"],
      },
      tags: ["cooking"],
      ...overrides,
    }),
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <CoupleProfilePage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CoupleProfilePage", () => {
  it("shows loading state before data arrives", () => {
    mockApiFetch.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("renders both partners' display names after loading", async () => {
    mockApiFetch.mockResolvedValueOnce(mockPairsResponse());
    renderPage();

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /Alex.*Jordan/i }),
      ).toBeInTheDocument(),
    );
  });

  it("renders shared about_us and location", async () => {
    mockApiFetch.mockResolvedValueOnce(mockPairsResponse());
    renderPage();

    await waitFor(() =>
      expect(screen.getByText("We love adventures")).toBeInTheDocument(),
    );
    expect(screen.getAllByText("Portland, OR").length).toBeGreaterThanOrEqual(
      1,
    );
  });

  it("renders shared tag in the Interests section and individual tags on partner cards", async () => {
    mockApiFetch.mockResolvedValueOnce(mockPairsResponse());
    renderPage();

    await waitFor(() =>
      expect(screen.getAllByText("cooking").length).toBeGreaterThanOrEqual(1),
    );
    // individual tags appear on partner cards
    expect(screen.getByText("hiking")).toBeInTheDocument();
    expect(screen.getByText("yoga")).toBeInTheDocument();
  });

  it("renders each partner's individual about_me and location", async () => {
    mockApiFetch.mockResolvedValueOnce(mockPairsResponse());
    renderPage();

    await waitFor(() =>
      expect(screen.getByText("Love hiking")).toBeInTheDocument(),
    );
    expect(screen.getByText("Love cooking")).toBeInTheDocument();
    expect(screen.getByText("Seattle, WA")).toBeInTheDocument();
  });

  it("includes an edit couple profile link pointing to /profile", async () => {
    mockApiFetch.mockResolvedValueOnce(mockPairsResponse());
    renderPage();

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /Alex.*Jordan/i }),
      ).toBeInTheDocument(),
    );

    const editLink = screen.getByRole("link", { name: /edit couple profile/i });
    expect(editLink).toHaveAttribute("href", "/profile");
  });

  it("shows not-paired message when user is not paired", async () => {
    mockApiFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: "You are not currently paired" }),
    });
    renderPage();

    await waitFor(() =>
      expect(screen.getByText(/no couple profile yet/i)).toBeInTheDocument(),
    );
  });
});
