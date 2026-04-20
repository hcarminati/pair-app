import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ConnectionsPage from "./ConnectionsPage";

vi.mock("../lib/api", () => ({
  apiFetch: vi.fn(),
}));

const { apiFetch } = await import("../lib/api");
const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;

const FIXTURE = [
  {
    request_id: "req-001",
    pair_id: "pair-1",
    about_us: "We love hiking and coffee.",
    location: "Denver, CO",
    tags: ["hiking", "coffee", "cycling"],
    partner1: {
      display_name: "Morgan",
      about_me: "Mountain person.",
      location: "Denver, CO",
      tags: ["hiking", "cycling"],
    },
    partner2: {
      display_name: "Casey",
      about_me: "Coffee enthusiast.",
      location: "Denver, CO",
      tags: ["coffee"],
    },
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    request_id: "req-002",
    pair_id: "pair-2",
    about_us: null,
    location: "Portland, OR",
    tags: ["board games", "cooking"],
    partner1: {
      display_name: "Alex",
      about_me: null,
      location: null,
      tags: ["board games"],
    },
    partner2: {
      display_name: "Jordan",
      about_me: null,
      location: "Portland, OR",
      tags: ["cooking"],
    },
    created_at: "2026-01-02T00:00:00Z",
  },
];

function mockSuccess(data = FIXTURE) {
  mockApiFetch.mockResolvedValue({
    ok: true,
    json: async () => data,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// US-16: As a connected couple, I want to see a list of all couples we are connected with.

describe("ConnectionsPage", () => {
  it("renders the page heading", async () => {
    mockSuccess();
    render(
      <MemoryRouter>
        <ConnectionsPage />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("heading", { name: /connections/i }),
    ).toBeInTheDocument();
  });

  it("fetches from /connections/connected on mount", async () => {
    mockSuccess();
    render(
      <MemoryRouter>
        <ConnectionsPage />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith("/connections/connected"),
    );
  });

  it("shows a loading state while the request is in flight", () => {
    // Never resolves — keeps the component in loading state
    mockApiFetch.mockReturnValue(new Promise(() => {}));
    render(
      <MemoryRouter>
        <ConnectionsPage />
      </MemoryRouter>,
    );
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("shows the empty state when there are no connected couples", async () => {
    mockSuccess([]);
    render(
      <MemoryRouter>
        <ConnectionsPage />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument(),
    );
    expect(
      screen.getByText(/your connected couples will appear here/i),
    ).toBeInTheDocument();
  });

  it("displays a card for each connected couple", async () => {
    mockSuccess();
    render(
      <MemoryRouter>
        <ConnectionsPage />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument(),
    );
    // Both couples rendered: "Morgan & Casey" and "Alex & Jordan"
    expect(screen.getByText(/morgan & casey/i)).toBeInTheDocument();
    expect(screen.getByText(/alex & jordan/i)).toBeInTheDocument();
  });

  it("displays tags for each connected couple", async () => {
    mockSuccess();
    render(
      <MemoryRouter>
        <ConnectionsPage />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument(),
    );
    expect(screen.getByText("hiking")).toBeInTheDocument();
    expect(screen.getByText("coffee")).toBeInTheDocument();
    expect(screen.getByText("board games")).toBeInTheDocument();
  });

  // Connected couples have no outbound interest CTA — connection is already established
  it("does not render an 'I'm interested' button on connected couple cards", async () => {
    mockSuccess();
    render(
      <MemoryRouter>
        <ConnectionsPage />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument(),
    );
    expect(
      screen.queryAllByRole("button", { name: /i'm interested/i }),
    ).toHaveLength(0);
  });

  it("shows an error message when the API call fails", async () => {
    mockApiFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Failed to load connections" }),
    });
    render(
      <MemoryRouter>
        <ConnectionsPage />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(
        screen.getByText(/failed to load connections/i),
      ).toBeInTheDocument(),
    );
  });

  it("shows a fallback error message when the API error body is missing", async () => {
    mockApiFetch.mockResolvedValue({
      ok: false,
      json: async () => ({}),
    });
    render(
      <MemoryRouter>
        <ConnectionsPage />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.getByText(/failed to load connections/i)).toBeInTheDocument(),
    );
  });

  it("shows an error message when the network request rejects", async () => {
    mockApiFetch.mockRejectedValue(new Error("Network error"));
    render(
      <MemoryRouter>
        <ConnectionsPage />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(
        screen.getByText(/failed to load connections/i),
      ).toBeInTheDocument(),
    );
  });

  it("renders partner initials derived from display names", async () => {
    mockSuccess([FIXTURE[0]!]);
    render(
      <MemoryRouter>
        <ConnectionsPage />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument(),
    );
    // "Morgan" → "MO", "Casey" → "CA"
    expect(screen.getByText("MO")).toBeInTheDocument();
    expect(screen.getByText("CA")).toBeInTheDocument();
  });

  it("handles nulls in partner fields without crashing", async () => {
    const withNulls = [
      {
        ...FIXTURE[0]!,
        partner1: null,
        partner2: null,
      },
    ];
    mockSuccess(withNulls);
    render(
      <MemoryRouter>
        <ConnectionsPage />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument(),
    );
    // Should still render a card without crashing; falls back to "? & ?"
    expect(screen.getByText(/\? & \?/i)).toBeInTheDocument();
  });
});
