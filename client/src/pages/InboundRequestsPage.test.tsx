import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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
    about_us: "Adventurous couple.",
    location: "Austin, TX",
    tags: ["hiking", "cooking"],
    partner1: {
      display_name: "Sam",
      about_me: "I like hikes.",
      location: "Austin, TX",
      tags: ["hiking"],
    },
    partner2: {
      display_name: "Riley",
      about_me: null,
      location: null,
      tags: ["cooking"],
    },
    created_at: "2025-01-01T00:00:00Z",
    my_response: null as boolean | null,
  },
];

function mockDefaultSuccess(inboundData = INBOUND_FIXTURE) {
  mockApiFetch.mockImplementation((url: string) => {
    if (url === "/connections/inbound")
      return Promise.resolve({ ok: true, json: async () => inboundData });
    if (url === "/pairs/me")
      return Promise.resolve({
        ok: true,
        json: async () => ({ tags: ["hiking"] }),
      });
    return Promise.resolve({
      ok: false,
      json: async () => ({ error: "not found" }),
    });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("InboundRequestsPage", () => {
  it("renders page heading", async () => {
    mockDefaultSuccess();
    render(
      <MemoryRouter>
        <InboundRequestsPage />
      </MemoryRouter>,
    );
    // Wait for loading to finish so the test only passes once data fetch completes
    await waitFor(() =>
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole("heading", { name: /inbound requests/i }),
    ).toBeInTheDocument();
  });

  it("shows placeholder when no inbound requests", async () => {
    mockDefaultSuccess([]);
    render(
      <MemoryRouter>
        <InboundRequestsPage />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument(),
    );
    expect(
      screen.getByText(
        /connection requests from other couples will appear here/i,
      ),
    ).toBeInTheDocument();
  });

  it("renders a card for each inbound result", async () => {
    mockDefaultSuccess();
    render(
      <MemoryRouter>
        <InboundRequestsPage />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument(),
    );
    // The CoupleCard renders names as "Sam & Riley"
    expect(screen.getByText("Sam & Riley")).toBeInTheDocument();
  });

  it("shows Accept and Decline buttons when my_response is null", async () => {
    mockDefaultSuccess();
    render(
      <MemoryRouter>
        <InboundRequestsPage />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /accept/i }),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByRole("button", { name: /decline/i }),
    ).toBeInTheDocument();
  });

  describe("polling tests (fake timers)", () => {
    beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
    afterEach(() => vi.useRealTimers());

    it("shows 'Waiting for partner' when my_response is already true", async () => {
      const fixtureWithResponse = [
        { ...INBOUND_FIXTURE[0], my_response: true },
      ];
      mockDefaultSuccess(fixtureWithResponse);
      render(
        <MemoryRouter>
          <InboundRequestsPage />
        </MemoryRouter>,
      );
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: /waiting for partner/i }),
        ).toBeInTheDocument(),
      );
    });

    it("clicking Accept calls respond endpoint with accept:true", async () => {
      mockApiFetch.mockImplementation((url: string) => {
        if (url === "/connections/inbound")
          return Promise.resolve({
            ok: true,
            json: async () => INBOUND_FIXTURE,
          });
        if (url === "/pairs/me")
          return Promise.resolve({
            ok: true,
            json: async () => ({ tags: ["hiking"] }),
          });
        if (url.includes("/respond"))
          return Promise.resolve({
            ok: true,
            json: async () => ({ status: "ACCEPTED" }),
          });
        return Promise.resolve({
          ok: false,
          json: async () => ({ error: "not found" }),
        });
      });

      render(
        <MemoryRouter>
          <InboundRequestsPage />
        </MemoryRouter>,
      );

      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: /accept/i }),
        ).toBeInTheDocument(),
      );

      await userEvent.click(screen.getByRole("button", { name: /accept/i }));

      await waitFor(() =>
        expect(mockApiFetch).toHaveBeenCalledWith(
          "/connections/req-1/respond",
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ accept: true }),
          }),
        ),
      );
    });

    it("clicking Decline calls respond endpoint with accept:false", async () => {
      mockApiFetch.mockImplementation((url: string) => {
        if (url === "/connections/inbound")
          return Promise.resolve({
            ok: true,
            json: async () => INBOUND_FIXTURE,
          });
        if (url === "/pairs/me")
          return Promise.resolve({
            ok: true,
            json: async () => ({ tags: ["hiking"] }),
          });
        if (url.includes("/respond"))
          return Promise.resolve({
            ok: true,
            json: async () => ({ status: "DECLINED" }),
          });
        return Promise.resolve({
          ok: false,
          json: async () => ({ error: "not found" }),
        });
      });

      render(
        <MemoryRouter>
          <InboundRequestsPage />
        </MemoryRouter>,
      );

      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: /decline/i }),
        ).toBeInTheDocument(),
      );

      await userEvent.click(screen.getByRole("button", { name: /decline/i }));

      await waitFor(() =>
        expect(mockApiFetch).toHaveBeenCalledWith(
          "/connections/req-1/respond",
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ accept: false }),
          }),
        ),
      );
    });

    it("shows 'Connected!' after respond returns CONNECTED", async () => {
      mockApiFetch.mockImplementation((url: string) => {
        if (url === "/connections/inbound")
          return Promise.resolve({
            ok: true,
            json: async () => INBOUND_FIXTURE,
          });
        if (url === "/pairs/me")
          return Promise.resolve({
            ok: true,
            json: async () => ({ tags: ["hiking"] }),
          });
        if (url.includes("/respond"))
          return Promise.resolve({
            ok: true,
            json: async () => ({ status: "CONNECTED" }),
          });
        return Promise.resolve({
          ok: false,
          json: async () => ({ error: "not found" }),
        });
      });

      render(
        <MemoryRouter>
          <InboundRequestsPage />
        </MemoryRouter>,
      );

      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: /accept/i }),
        ).toBeInTheDocument(),
      );

      await userEvent.click(screen.getByRole("button", { name: /accept/i }));

      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: /connected!/i }),
        ).toBeInTheDocument(),
      );
    });

    it("shows 'Declined' after clicking Decline", async () => {
      mockApiFetch.mockImplementation((url: string) => {
        if (url === "/connections/inbound")
          return Promise.resolve({
            ok: true,
            json: async () => INBOUND_FIXTURE,
          });
        if (url === "/pairs/me")
          return Promise.resolve({
            ok: true,
            json: async () => ({ tags: ["hiking"] }),
          });
        if (url.includes("/respond"))
          return Promise.resolve({
            ok: true,
            // Return a non-CONNECTED status so the client sets responses to false
            json: async () => ({ status: "DECLINED" }),
          });
        return Promise.resolve({
          ok: false,
          json: async () => ({ error: "not found" }),
        });
      });

      render(
        <MemoryRouter>
          <InboundRequestsPage />
        </MemoryRouter>,
      );

      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: /decline/i }),
        ).toBeInTheDocument(),
      );

      await userEvent.click(screen.getByRole("button", { name: /decline/i }));

      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: /^declined$/i }),
        ).toBeInTheDocument(),
      );
    });

    it("polling removes card when request disappears from server", async () => {
      // Seed my_response: true to trigger hasWaiting → starts polling interval
      const fixtureWithWaiting = [{ ...INBOUND_FIXTURE[0], my_response: true }];

      let callCount = 0;
      mockApiFetch.mockImplementation((url: string) => {
        if (url === "/connections/inbound") {
          callCount += 1;
          // First call returns fixture with the card; subsequent polls return empty
          const data = callCount === 1 ? fixtureWithWaiting : [];
          return Promise.resolve({ ok: true, json: async () => data });
        }
        if (url === "/pairs/me")
          return Promise.resolve({
            ok: true,
            json: async () => ({ tags: ["hiking"] }),
          });
        return Promise.resolve({
          ok: false,
          json: async () => ({ error: "not found" }),
        });
      });

      render(
        <MemoryRouter>
          <InboundRequestsPage />
        </MemoryRouter>,
      );

      // Wait for initial render to show "Waiting for partner"
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: /waiting for partner/i }),
        ).toBeInTheDocument(),
      );

      // Advance timers past the 3-second interval to trigger the poll
      await vi.advanceTimersByTimeAsync(3100);

      // After poll returns [], the card should no longer be visible
      await waitFor(() =>
        expect(screen.queryByText("Sam & Riley")).not.toBeInTheDocument(),
      );
    });

    it("double-submit guard: respond endpoint never called when my_response is already true", async () => {
      // Seed my_response: true from server — the guard blocks further calls
      const fixtureAlreadyResponded = [
        { ...INBOUND_FIXTURE[0], my_response: true },
      ];
      mockDefaultSuccess(fixtureAlreadyResponded);

      render(
        <MemoryRouter>
          <InboundRequestsPage />
        </MemoryRouter>,
      );

      // Wait for the "Waiting for partner" button to appear (no Accept/Decline shown)
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: /waiting for partner/i }),
        ).toBeInTheDocument(),
      );

      // The respond endpoint should never have been called
      const respondCalls = mockApiFetch.mock.calls.filter(
        (args: unknown[]) =>
          typeof args[0] === "string" && args[0].includes("/respond"),
      );
      expect(respondCalls).toHaveLength(0);
    });

    // Verifies the responding user's view shows a generic 'Declined' label with no
    // partner name attribution. FR-CONN-08 (couple 1 cannot see which partner on
    // couple 2 declined) is covered by the backend.
    it("privacy: declined entry shows no partner attribution", async () => {
      mockApiFetch.mockImplementation((url: string) => {
        if (url === "/connections/inbound")
          return Promise.resolve({
            ok: true,
            json: async () => INBOUND_FIXTURE,
          });
        if (url === "/pairs/me")
          return Promise.resolve({
            ok: true,
            json: async () => ({ tags: ["hiking"] }),
          });
        if (url.includes("/respond"))
          return Promise.resolve({
            ok: true,
            json: async () => ({ status: "DECLINED" }),
          });
        return Promise.resolve({
          ok: false,
          json: async () => ({ error: "not found" }),
        });
      });

      render(
        <MemoryRouter>
          <InboundRequestsPage />
        </MemoryRouter>,
      );

      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: /decline/i }),
        ).toBeInTheDocument(),
      );

      await userEvent.click(screen.getByRole("button", { name: /decline/i }));

      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: /^declined$/i }),
        ).toBeInTheDocument(),
      );

      // No text attributing the decline to a specific partner should appear
      expect(screen.queryByText(/sam declined/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/riley declined/i)).not.toBeInTheDocument();
    });
  });

  it("shows error message when inbound API fails", async () => {
    mockApiFetch.mockImplementation((url: string) => {
      if (url === "/connections/inbound")
        return Promise.resolve({
          ok: false,
          json: async () => ({ error: "Failed to load inbound requests" }),
        });
      if (url === "/pairs/me")
        return Promise.resolve({
          ok: true,
          json: async () => ({ tags: [] }),
        });
      return Promise.resolve({
        ok: false,
        json: async () => ({ error: "not found" }),
      });
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

  it("partner1 null fallback: renders without crash and shows '?' placeholder", async () => {
    const fixtureNullPartner = [
      {
        ...INBOUND_FIXTURE[0],
        partner1: null as (typeof INBOUND_FIXTURE)[0]["partner1"] | null,
      },
    ];
    mockDefaultSuccess(fixtureNullPartner as typeof INBOUND_FIXTURE);

    render(
      <MemoryRouter>
        <InboundRequestsPage />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument(),
    );

    // toCouple() falls back to "?" for null partner1; names become "? & Riley"
    expect(screen.getByText("? & Riley")).toBeInTheDocument();
  });

  describe("CoupleDetailModal integration", () => {
    it("clicking a card opens the modal", async () => {
      mockDefaultSuccess();
      render(
        <MemoryRouter>
          <InboundRequestsPage />
        </MemoryRouter>,
      );

      await waitFor(() =>
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument(),
      );

      await userEvent.click(document.querySelector(".couple-card")!);

      expect(
        screen.getByRole("heading", { name: /sam & riley/i, level: 2 }),
      ).toBeInTheDocument();
    });

    it("closing modal via × button removes the modal heading", async () => {
      mockDefaultSuccess();
      render(
        <MemoryRouter>
          <InboundRequestsPage />
        </MemoryRouter>,
      );

      await waitFor(() =>
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument(),
      );

      await userEvent.click(document.querySelector(".couple-card")!);

      // Modal should be open
      expect(
        screen.getByRole("heading", { name: /sam & riley/i, level: 2 }),
      ).toBeInTheDocument();

      await userEvent.click(document.querySelector(".discovery-modal-close")!);

      expect(
        screen.queryByRole("heading", { name: /sam & riley/i, level: 2 }),
      ).not.toBeInTheDocument();
    });

    it("closing modal via overlay removes the modal heading", async () => {
      mockDefaultSuccess();
      render(
        <MemoryRouter>
          <InboundRequestsPage />
        </MemoryRouter>,
      );

      await waitFor(() =>
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument(),
      );

      await userEvent.click(document.querySelector(".couple-card")!);

      // Modal should be open
      expect(
        screen.getByRole("heading", { name: /sam & riley/i, level: 2 }),
      ).toBeInTheDocument();

      await userEvent.click(
        document.querySelector(".discovery-modal-overlay")!,
      );

      expect(
        screen.queryByRole("heading", { name: /sam & riley/i, level: 2 }),
      ).not.toBeInTheDocument();
    });

    it("hideCta: no 'I'm interested' button shown in modal", async () => {
      mockDefaultSuccess();
      render(
        <MemoryRouter>
          <InboundRequestsPage />
        </MemoryRouter>,
      );

      await waitFor(() =>
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument(),
      );

      await userEvent.click(document.querySelector(".couple-card")!);

      // Modal is open; hideCta prop should suppress the CTA
      expect(
        screen.queryByRole("button", { name: /i'm interested/i }),
      ).not.toBeInTheDocument();
    });
  });
});
