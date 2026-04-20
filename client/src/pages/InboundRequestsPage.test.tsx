import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import InboundRequestsPage from "./InboundRequestsPage";

vi.mock("../lib/api", () => ({
  apiFetch: vi.fn(),
}));

const { apiFetch } = await import("../lib/api");
const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;

const INBOUND_FIXTURE = [
  {
    request_id: "req-1",
    pair_id: "pair-1",
    about_us: "We love hiking together.",
    location: "Denver, CO",
    tags: ["hiking", "cycling", "films"],
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
    created_at: "2026-01-01T00:00:00Z",
    my_response: null,
  },
];

const PAIR_FIXTURE = {
  tags: ["hiking", "board games"],
};

function mockSuccess() {
  mockApiFetch.mockImplementation((url: string) => {
    if (url === "/connections/inbound") {
      return Promise.resolve({
        ok: true,
        json: async () => INBOUND_FIXTURE,
      });
    }
    if (url === "/pairs/me") {
      return Promise.resolve({
        ok: true,
        json: async () => PAIR_FIXTURE,
      });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("InboundRequestsPage", () => {
  it("renders the page heading", async () => {
    mockSuccess();
    render(
      <MemoryRouter>
        <InboundRequestsPage />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("heading", { name: /inbound requests/i }),
    ).toBeInTheDocument();
  });

  it("shows loading state initially", () => {
    mockApiFetch.mockReturnValue(new Promise(() => {}));
    render(
      <MemoryRouter>
        <InboundRequestsPage />
      </MemoryRouter>,
    );
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("shows couple cards after loading", async () => {
    mockSuccess();
    render(
      <MemoryRouter>
        <InboundRequestsPage />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument(),
    );

    expect(screen.getByText(/morgan & casey/i)).toBeInTheDocument();
  });

  it("shows empty state when there are no inbound requests", async () => {
    mockApiFetch.mockImplementation((url: string) => {
      if (url === "/connections/inbound") {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      return Promise.resolve({ ok: true, json: async () => PAIR_FIXTURE });
    });

    render(
      <MemoryRouter>
        <InboundRequestsPage />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(
        screen.getByText(/connection requests from other couples/i),
      ).toBeInTheDocument(),
    );
  });

  it("shows error message when the API call fails", async () => {
    mockApiFetch.mockImplementation((url: string) => {
      if (url === "/connections/inbound") {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: async () => ({ error: "Failed to load inbound requests" }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => PAIR_FIXTURE });
    });

    render(
      <MemoryRouter>
        <InboundRequestsPage />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(
        screen.getByText(/failed to load inbound requests/i),
      ).toBeInTheDocument(),
    );
  });

  it("shows Accept and Decline buttons for unanswered requests", async () => {
    mockSuccess();
    render(
      <MemoryRouter>
        <InboundRequestsPage />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument(),
    );

    expect(screen.getByRole("button", { name: /^accept$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^decline$/i })).toBeInTheDocument();
  });

  it("shows 'Waiting for partner' after accepting", async () => {
    mockSuccess();
    mockApiFetch.mockImplementation((url: string) => {
      if (url === "/connections/inbound") {
        return Promise.resolve({ ok: true, json: async () => INBOUND_FIXTURE });
      }
      if (url === "/pairs/me") {
        return Promise.resolve({ ok: true, json: async () => PAIR_FIXTURE });
      }
      if (url === "/connections/req-1/respond") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ status: "REQUEST_PENDING" }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(
      <MemoryRouter>
        <InboundRequestsPage />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^accept$/i })).toBeInTheDocument(),
    );

    await userEvent.click(screen.getByRole("button", { name: /^accept$/i }));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /waiting for partner/i }),
      ).toBeInTheDocument(),
    );
  });

  it("shows 'Declined' after declining", async () => {
    mockSuccess();
    mockApiFetch.mockImplementation((url: string) => {
      if (url === "/connections/inbound") {
        return Promise.resolve({ ok: true, json: async () => INBOUND_FIXTURE });
      }
      if (url === "/pairs/me") {
        return Promise.resolve({ ok: true, json: async () => PAIR_FIXTURE });
      }
      if (url === "/connections/req-1/respond") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ status: "DECLINED" }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(
      <MemoryRouter>
        <InboundRequestsPage />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^decline$/i })).toBeInTheDocument(),
    );

    await userEvent.click(screen.getByRole("button", { name: /^decline$/i }));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /^declined$/i }),
      ).toBeInTheDocument(),
    );
  });

  describe("CoupleDetailModal integration", () => {
    it("modal is not visible initially", async () => {
      mockSuccess();
      render(
        <MemoryRouter>
          <InboundRequestsPage />
        </MemoryRouter>,
      );

      await waitFor(() =>
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument(),
      );

      expect(
        document.querySelector(".discovery-modal-overlay"),
      ).not.toBeInTheDocument();
    });

    it("opens the modal when a couple card is clicked", async () => {
      mockSuccess();
      render(
        <MemoryRouter>
          <InboundRequestsPage />
        </MemoryRouter>,
      );

      await waitFor(() =>
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument(),
      );

      const card = document.querySelector(".couple-card")!;
      await userEvent.click(card);

      expect(
        document.querySelector(".discovery-modal-overlay"),
      ).toBeInTheDocument();
    });

    it("modal shows couple name and location", async () => {
      mockSuccess();
      render(
        <MemoryRouter>
          <InboundRequestsPage />
        </MemoryRouter>,
      );

      await waitFor(() =>
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument(),
      );

      const card = document.querySelector(".couple-card")!;
      await userEvent.click(card);

      expect(
        screen.getByRole("heading", { name: /morgan & casey/i }),
      ).toBeInTheDocument();
      expect(screen.getAllByText("Denver, CO").length).toBeGreaterThan(0);
    });

    it("modal shows about_us and partner details", async () => {
      mockSuccess();
      render(
        <MemoryRouter>
          <InboundRequestsPage />
        </MemoryRouter>,
      );

      await waitFor(() =>
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument(),
      );

      const card = document.querySelector(".couple-card")!;
      await userEvent.click(card);

      expect(
        screen.getByText("We love hiking together."),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: /partners/i }),
      ).toBeInTheDocument();
      expect(screen.getByText("I love the mountains.")).toBeInTheDocument();
    });

    it("modal does not show an 'Interested' CTA (hideCta)", async () => {
      mockSuccess();
      render(
        <MemoryRouter>
          <InboundRequestsPage />
        </MemoryRouter>,
      );

      await waitFor(() =>
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument(),
      );

      const card = document.querySelector(".couple-card")!;
      await userEvent.click(card);

      // The modal should be open but have no "interested" CTA button
      expect(
        document.querySelector(".discovery-modal-overlay"),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /i'm interested/i }),
      ).not.toBeInTheDocument();
    });

    it("closes the modal when the close button is clicked", async () => {
      mockSuccess();
      render(
        <MemoryRouter>
          <InboundRequestsPage />
        </MemoryRouter>,
      );

      await waitFor(() =>
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument(),
      );

      const card = document.querySelector(".couple-card")!;
      await userEvent.click(card);

      expect(
        document.querySelector(".discovery-modal-overlay"),
      ).toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: /×/i }));

      expect(
        document.querySelector(".discovery-modal-overlay"),
      ).not.toBeInTheDocument();
    });

    it("closes the modal when the overlay backdrop is clicked", async () => {
      mockSuccess();
      render(
        <MemoryRouter>
          <InboundRequestsPage />
        </MemoryRouter>,
      );

      await waitFor(() =>
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument(),
      );

      const card = document.querySelector(".couple-card")!;
      await userEvent.click(card);

      const overlay = document.querySelector(".discovery-modal-overlay")!;
      await userEvent.click(overlay);

      expect(
        document.querySelector(".discovery-modal-overlay"),
      ).not.toBeInTheDocument();
    });
  });
});
