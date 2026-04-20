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
      screen.getByText(/connection requests from other couples will appear here/i),
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
      expect(screen.getByRole("button", { name: /accept/i })).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: /decline/i })).toBeInTheDocument();
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
      mockApiFetch.mockImplementation(
        (url: string) => {
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
        },
      );

      render(
        <MemoryRouter>
          <InboundRequestsPage />
        </MemoryRouter>,
      );

      await waitFor(() =>
        expect(screen.getByRole("button", { name: /accept/i })).toBeInTheDocument(),
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
      mockApiFetch.mockImplementation(
        (url: string) => {
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
        },
      );

      render(
        <MemoryRouter>
          <InboundRequestsPage />
        </MemoryRouter>,
      );

      await waitFor(() =>
        expect(screen.getByRole("button", { name: /decline/i })).toBeInTheDocument(),
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
      mockApiFetch.mockImplementation(
        (url: string) => {
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
        },
      );

      render(
        <MemoryRouter>
          <InboundRequestsPage />
        </MemoryRouter>,
      );

      await waitFor(() =>
        expect(screen.getByRole("button", { name: /accept/i })).toBeInTheDocument(),
      );

      await userEvent.click(screen.getByRole("button", { name: /accept/i }));

      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: /connected!/i }),
        ).toBeInTheDocument(),
      );
    });

    it("shows 'Declined' after clicking Decline", async () => {
      mockApiFetch.mockImplementation(
        (url: string) => {
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
        },
      );

      render(
        <MemoryRouter>
          <InboundRequestsPage />
        </MemoryRouter>,
      );

      await waitFor(() =>
        expect(screen.getByRole("button", { name: /decline/i })).toBeInTheDocument(),
      );

      await userEvent.click(screen.getByRole("button", { name: /decline/i }));

      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: /^declined$/i }),
        ).toBeInTheDocument(),
      );
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

  it("privacy: declined entry shows no partner attribution", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockApiFetch.mockImplementation(
      (url: string) => {
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
      },
    );

    render(
      <MemoryRouter>
        <InboundRequestsPage />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /decline/i })).toBeInTheDocument(),
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

    vi.useRealTimers();
  });
});
