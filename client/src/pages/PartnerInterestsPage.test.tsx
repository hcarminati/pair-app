import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import PartnerInterestsPage from "./PartnerInterestsPage";

vi.mock("../lib/api", () => ({
  apiFetch: vi.fn(),
}));

const { apiFetch } = await import("../lib/api");
const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;

const INTERESTS_FIXTURE = [
  {
    request_id: "req-1",
    pair_id: "pair-1",
    about_us: "Outdoor enthusiasts.",
    location: "Portland, OR",
    tags: ["hiking", "board games", "cooking"],
    partner1: {
      display_name: "Alex",
      about_me: "Love the outdoors.",
      location: "Portland, OR",
      tags: ["hiking", "board games"],
    },
    partner2: {
      display_name: "Jordan",
      about_me: "Home chef.",
      location: "Portland, OR",
      tags: ["cooking", "board games"],
    },
    created_at: "2026-01-01T00:00:00Z",
  },
];

const PAIR_FIXTURE = {
  tags: ["hiking", "cycling"],
};

function mockSuccess() {
  mockApiFetch.mockImplementation((url: string) => {
    if (url === "/connections/partner-interests") {
      return Promise.resolve({
        ok: true,
        json: async () => INTERESTS_FIXTURE,
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

describe("PartnerInterestsPage", () => {
  it("renders the page heading", async () => {
    mockSuccess();
    render(
      <MemoryRouter>
        <PartnerInterestsPage />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("heading", { name: /partner's interests/i }),
    ).toBeInTheDocument();
  });

  it("shows loading state initially", () => {
    mockApiFetch.mockReturnValue(new Promise(() => {}));
    render(
      <MemoryRouter>
        <PartnerInterestsPage />
      </MemoryRouter>,
    );
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("shows couple cards after loading", async () => {
    mockSuccess();
    render(
      <MemoryRouter>
        <PartnerInterestsPage />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument(),
    );

    expect(screen.getByText(/alex & jordan/i)).toBeInTheDocument();
  });

  it("shows empty state when there are no partner interests", async () => {
    mockApiFetch.mockImplementation((url: string) => {
      if (url === "/connections/partner-interests") {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      return Promise.resolve({ ok: true, json: async () => PAIR_FIXTURE });
    });

    render(
      <MemoryRouter>
        <PartnerInterestsPage />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(
        screen.getByText(/your partner's selected interests/i),
      ).toBeInTheDocument(),
    );
  });

  it("shows error message when the API call fails", async () => {
    mockApiFetch.mockImplementation((url: string) => {
      if (url === "/connections/partner-interests") {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: async () => ({ error: "Failed to load partner interests" }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => PAIR_FIXTURE });
    });

    render(
      <MemoryRouter>
        <PartnerInterestsPage />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(
        screen.getByText(/failed to load partner interests/i),
      ).toBeInTheDocument(),
    );
  });

  it("shows Approve and Decline buttons for undecided interests", async () => {
    mockSuccess();
    render(
      <MemoryRouter>
        <PartnerInterestsPage />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument(),
    );

    expect(screen.getByRole("button", { name: /^approve$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^decline$/i })).toBeInTheDocument();
  });

  it("shows 'Interested' after approving", async () => {
    mockSuccess();
    mockApiFetch.mockImplementation((url: string) => {
      if (url === "/connections/partner-interests") {
        return Promise.resolve({ ok: true, json: async () => INTERESTS_FIXTURE });
      }
      if (url === "/pairs/me") {
        return Promise.resolve({ ok: true, json: async () => PAIR_FIXTURE });
      }
      if (url === "/connections/req-1/align") {
        return Promise.resolve({ ok: true, json: async () => ({}) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(
      <MemoryRouter>
        <PartnerInterestsPage />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^approve$/i })).toBeInTheDocument(),
    );

    await userEvent.click(screen.getByRole("button", { name: /^approve$/i }));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /^interested$/i }),
      ).toBeInTheDocument(),
    );
  });

  it("shows 'Declined' after declining", async () => {
    mockSuccess();
    mockApiFetch.mockImplementation((url: string) => {
      if (url === "/connections/partner-interests") {
        return Promise.resolve({ ok: true, json: async () => INTERESTS_FIXTURE });
      }
      if (url === "/pairs/me") {
        return Promise.resolve({ ok: true, json: async () => PAIR_FIXTURE });
      }
      if (url === "/connections/req-1/veto") {
        return Promise.resolve({ ok: true, json: async () => ({}) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(
      <MemoryRouter>
        <PartnerInterestsPage />
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
          <PartnerInterestsPage />
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
          <PartnerInterestsPage />
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
          <PartnerInterestsPage />
        </MemoryRouter>,
      );

      await waitFor(() =>
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument(),
      );

      const card = document.querySelector(".couple-card")!;
      await userEvent.click(card);

      expect(
        screen.getByRole("heading", { name: /alex & jordan/i }),
      ).toBeInTheDocument();
      expect(screen.getAllByText("Portland, OR").length).toBeGreaterThan(0);
    });

    it("modal shows about_us and partner details", async () => {
      mockSuccess();
      render(
        <MemoryRouter>
          <PartnerInterestsPage />
        </MemoryRouter>,
      );

      await waitFor(() =>
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument(),
      );

      const card = document.querySelector(".couple-card")!;
      await userEvent.click(card);

      expect(screen.getByText("Outdoor enthusiasts.")).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: /partners/i }),
      ).toBeInTheDocument();
      expect(screen.getByText("Love the outdoors.")).toBeInTheDocument();
      expect(screen.getByText("Home chef.")).toBeInTheDocument();
    });

    it("modal does not show an 'Interested' CTA (hideCta)", async () => {
      mockSuccess();
      render(
        <MemoryRouter>
          <PartnerInterestsPage />
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
      expect(
        screen.queryByRole("button", { name: /i'm interested/i }),
      ).not.toBeInTheDocument();
    });

    it("closes the modal when the close button is clicked", async () => {
      mockSuccess();
      render(
        <MemoryRouter>
          <PartnerInterestsPage />
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
          <PartnerInterestsPage />
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
