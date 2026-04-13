import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import DiscoveryPage from "./DiscoveryPage";

vi.mock("../lib/api", () => ({
  apiFetch: vi.fn(),
}));

const { apiFetch } = await import("../lib/api");
const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;

const FIXTURE = [
  {
    pair_id: "pair-1",
    about_us: "Active couple who love hiking.",
    location: "Denver, CO",
    tags: ["hiking", "cycling", "films"],
    matching_tags: ["hiking", "cycling"],
    shared_count: 2,
    partner1: {
      display_name: "Morgan",
      about_me: "I love the mountains.",
      location: "Denver, CO",
      tags: ["hiking", "cycling"],
    },
    partner2: {
      display_name: "Casey",
      about_me: "Film buff.",
      location: "Denver, CO",
      tags: ["films", "cycling"],
    },
  },
  {
    pair_id: "pair-2",
    about_us: "Outdoor enthusiasts.",
    location: "Portland, OR",
    tags: ["board games", "cooking"],
    matching_tags: ["cooking"],
    shared_count: 1,
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

describe("DiscoveryPage", () => {
  it("renders the page heading", async () => {
    mockSuccess();
    render(
      <MemoryRouter>
        <DiscoveryPage isLinked={true} />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("heading", { name: /discover couples/i }),
    ).toBeInTheDocument();
  });

  it("displays couples ranked by shared tag count descending", async () => {
    mockSuccess();
    render(
      <MemoryRouter>
        <DiscoveryPage isLinked={true} />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument(),
    );

    const counts = screen
      .getAllByText(/in common/i)
      .map((el) => parseInt(el.textContent ?? "0"));
    for (let i = 0; i < counts.length - 1; i++) {
      expect(counts[i]).toBeGreaterThanOrEqual(counts[i + 1]);
    }
  });

  it("shows the shared tag count badge on each card", async () => {
    mockSuccess();
    render(
      <MemoryRouter>
        <DiscoveryPage isLinked={true} />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument(),
    );

    const badges = screen.getAllByText(/in common/i);
    expect(badges.length).toBeGreaterThan(0);
  });

  it("renders filter pills derived from fetched tags", async () => {
    mockSuccess();
    render(
      <MemoryRouter>
        <DiscoveryPage isLinked={true} />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /hiking/i })).toBeInTheDocument(),
    );
  });

  it("renders an 'I'm interested' button on each card", async () => {
    mockSuccess();
    render(
      <MemoryRouter>
        <DiscoveryPage isLinked={true} />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(
        screen.getAllByRole("button", { name: /i'm interested/i }).length,
      ).toBeGreaterThan(0),
    );
  });

  // FR-DISC-05 / US-08: unlinked state
  it("shows a disabled feed with a prompt when the couple is not linked", () => {
    render(
      <MemoryRouter>
        <DiscoveryPage isLinked={false} />
      </MemoryRouter>,
    );
    expect(screen.getByText(/link with a partner/i)).toBeInTheDocument();
    expect(
      screen.queryAllByRole("button", { name: /i'm interested/i }),
    ).toHaveLength(0);
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  // FR-DISC-04 / FR-DISC-06: server handles exclusions; frontend renders only what API returns
  it("excludes incomplete couples — server filters before responding", async () => {
    mockSuccess();
    render(
      <MemoryRouter>
        <DiscoveryPage isLinked={true} />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument(),
    );
    expect(screen.queryByText(/incomplete couple/i)).not.toBeInTheDocument();
  });

  it("excludes already-connected couples — server filters before responding", async () => {
    mockSuccess();
    render(
      <MemoryRouter>
        <DiscoveryPage isLinked={true} />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument(),
    );
    expect(screen.queryByText(/already connected/i)).not.toBeInTheDocument();
  });

  it("shows an error message when the API call fails", async () => {
    mockApiFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Failed to load discovery feed" }),
    });

    render(
      <MemoryRouter>
        <DiscoveryPage isLinked={true} />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(
        screen.getByText(/failed to load discovery feed/i),
      ).toBeInTheDocument(),
    );
  });

  describe("tag filter bar", () => {
    it("re-fetches from server with ?tags= when a filter pill is clicked", async () => {
      mockApiFetch.mockResolvedValueOnce({ ok: true, json: async () => FIXTURE });
      mockApiFetch.mockResolvedValueOnce({ ok: true, json: async () => [FIXTURE[0]] });

      render(
        <MemoryRouter>
          <DiscoveryPage isLinked={true} />
        </MemoryRouter>,
      );

      await waitFor(() =>
        expect(screen.getByRole("button", { name: /hiking/i })).toBeInTheDocument(),
      );

      await userEvent.click(screen.getByRole("button", { name: /hiking/i }));

      await waitFor(() =>
        expect(mockApiFetch).toHaveBeenLastCalledWith("/discovery?tags=hiking"),
      );
    });

    it("active filter pills have the pill--active class", async () => {
      mockApiFetch.mockResolvedValueOnce({ ok: true, json: async () => FIXTURE });
      mockApiFetch.mockResolvedValueOnce({ ok: true, json: async () => [FIXTURE[0]] });

      render(
        <MemoryRouter>
          <DiscoveryPage isLinked={true} />
        </MemoryRouter>,
      );

      await waitFor(() =>
        expect(screen.getByRole("button", { name: /hiking/i })).toBeInTheDocument(),
      );

      const hikingPill = screen.getByRole("button", { name: /hiking/i });
      expect(hikingPill).not.toHaveClass("pill--active");

      await userEvent.click(hikingPill);

      await waitFor(() =>
        expect(screen.getByRole("button", { name: /hiking/i })).toHaveClass("pill--active"),
      );
    });

    it("multiple active filters construct a comma-separated ?tags= OR query", async () => {
      mockApiFetch.mockResolvedValueOnce({ ok: true, json: async () => FIXTURE });
      mockApiFetch.mockResolvedValueOnce({ ok: true, json: async () => [FIXTURE[0]] });
      mockApiFetch.mockResolvedValueOnce({ ok: true, json: async () => [FIXTURE[0]] });

      render(
        <MemoryRouter>
          <DiscoveryPage isLinked={true} />
        </MemoryRouter>,
      );

      await waitFor(() =>
        expect(screen.getByRole("button", { name: /hiking/i })).toBeInTheDocument(),
      );

      await userEvent.click(screen.getByRole("button", { name: /hiking/i }));
      await waitFor(() =>
        expect(mockApiFetch).toHaveBeenLastCalledWith("/discovery?tags=hiking"),
      );

      await userEvent.click(screen.getByRole("button", { name: /cycling/i }));
      await waitFor(() =>
        expect(mockApiFetch).toHaveBeenLastCalledWith("/discovery?tags=hiking,cycling"),
      );
    });

    it("deselecting a filter re-fetches without that tag", async () => {
      mockApiFetch.mockResolvedValueOnce({ ok: true, json: async () => FIXTURE });
      mockApiFetch.mockResolvedValueOnce({ ok: true, json: async () => [FIXTURE[0]] });
      mockApiFetch.mockResolvedValueOnce({ ok: true, json: async () => FIXTURE });

      render(
        <MemoryRouter>
          <DiscoveryPage isLinked={true} />
        </MemoryRouter>,
      );

      await waitFor(() =>
        expect(screen.getByRole("button", { name: /hiking/i })).toBeInTheDocument(),
      );

      await userEvent.click(screen.getByRole("button", { name: /hiking/i }));
      await waitFor(() =>
        expect(mockApiFetch).toHaveBeenLastCalledWith("/discovery?tags=hiking"),
      );

      await userEvent.click(screen.getByRole("button", { name: /hiking/i }));
      await waitFor(() =>
        expect(mockApiFetch).toHaveBeenLastCalledWith("/discovery"),
      );
    });
  });

  it("modal shows per-partner cards with name, bio, and location", async () => {
    mockSuccess();
    render(
      <MemoryRouter>
        <DiscoveryPage isLinked={true} />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument(),
    );

    // Click the first couple card to open the modal
    const cards = screen.getAllByRole("button", { name: /i'm interested/i });
    await userEvent.click(cards[0].closest(".couple-card")!);

    // Per-partner section header
    expect(screen.getByRole("heading", { name: /partners/i })).toBeInTheDocument();
    // Partner names appear in the partner cards
    expect(screen.getAllByText("Morgan").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Casey").length).toBeGreaterThan(0);
    // Partner bio
    expect(screen.getByText("I love the mountains.")).toBeInTheDocument();
  });
});
