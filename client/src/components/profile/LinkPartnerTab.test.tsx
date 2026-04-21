import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LinkPartnerTab } from "./LinkPartnerTab";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("../../lib/api", () => ({ apiFetch: vi.fn() }));
vi.mock("../../lib/authStore", () => ({ setIsPaired: vi.fn() }));

const { apiFetch } = await import("../../lib/api");
const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;

const { setIsPaired } = await import("../../lib/authStore");
const mockSetIsPaired = setIsPaired as ReturnType<typeof vi.fn>;

function renderPaired(onUnlink = vi.fn()) {
  return render(
    <MemoryRouter>
      <LinkPartnerTab
        paired
        inviteToken={null}
        tokenExpiresAt={null}
        tokenLoading={false}
        tokenError=""
        onUnlink={onUnlink}
      />
    </MemoryRouter>,
  );
}

function renderUnpaired({
  inviteToken = null as string | null,
  tokenExpiresAt = null as string | null,
  tokenLoading = false,
  tokenError = "",
} = {}) {
  return render(
    <MemoryRouter>
      <LinkPartnerTab
        paired={false}
        inviteToken={inviteToken}
        tokenExpiresAt={tokenExpiresAt}
        tokenLoading={tokenLoading}
        tokenError={tokenError}
        onUnlink={vi.fn()}
      />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

describe("LinkPartnerTab — unlink confirmation", () => {
  it("shows Unlink partner button when paired", () => {
    renderPaired();
    expect(
      screen.getByRole("button", { name: /unlink partner/i }),
    ).toBeInTheDocument();
  });

  it("shows confirmation UI after clicking Unlink partner", async () => {
    renderPaired();
    await userEvent.click(
      screen.getByRole("button", { name: /unlink partner/i }),
    );
    expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /yes, unlink/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("does not call onUnlink when clicking Unlink partner", async () => {
    const onUnlink = vi.fn();
    renderPaired(onUnlink);
    await userEvent.click(
      screen.getByRole("button", { name: /unlink partner/i }),
    );
    expect(onUnlink).not.toHaveBeenCalled();
  });

  it("cancels confirmation and returns to initial state", async () => {
    renderPaired();
    await userEvent.click(
      screen.getByRole("button", { name: /unlink partner/i }),
    );
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(
      screen.getByRole("button", { name: /unlink partner/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/are you sure/i)).not.toBeInTheDocument();
  });

  it("calls onUnlink when confirming", async () => {
    const onUnlink = vi.fn().mockResolvedValue(undefined);
    renderPaired(onUnlink);
    await userEvent.click(
      screen.getByRole("button", { name: /unlink partner/i }),
    );
    await userEvent.click(screen.getByRole("button", { name: /yes, unlink/i }));
    await waitFor(() => expect(onUnlink).toHaveBeenCalledOnce());
  });
});

describe("LinkPartnerTab — invite token display", () => {
  it("shows loading message while token is being generated", () => {
    renderUnpaired({ tokenLoading: true });
    expect(screen.getByText(/generating your token/i)).toBeInTheDocument();
  });

  it("shows token error when one is provided", () => {
    renderUnpaired({ tokenError: "Failed to generate token" });
    expect(screen.getByText("Failed to generate token")).toBeInTheDocument();
  });

  it("shows the invite token in the token box", () => {
    renderUnpaired({ inviteToken: "TEST-LINK-TOKEN" });
    expect(screen.getByText("TEST-LINK-TOKEN")).toBeInTheDocument();
  });

  it("shows 'Expires in 72 hours' when tokenExpiresAt is null", () => {
    renderUnpaired({ inviteToken: "TEST-LINK-TOKEN", tokenExpiresAt: null });
    expect(screen.getByText(/expires in 72 hours/i)).toBeInTheDocument();
  });

  it("shows 'Copied!' after clicking the copy button", async () => {
    renderUnpaired({ inviteToken: "TEST-LINK-TOKEN" });
    const copyBtn = screen.getByRole("button", { name: /copy link/i });
    await userEvent.click(copyBtn);
    expect(
      screen.getByRole("button", { name: /copied!/i }),
    ).toBeInTheDocument();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "TEST-LINK-TOKEN",
    );
  });

  it("does not show the token box when inviteToken is null", () => {
    renderUnpaired({ inviteToken: null });
    expect(
      screen.queryByRole("button", { name: /copy link/i }),
    ).not.toBeInTheDocument();
  });

  describe("expiry formatting", () => {
    const FIXED_NOW = new Date("2025-06-01T12:00:00.000Z").getTime();

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(FIXED_NOW);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("shows hours-based expiry when more than one hour remains", () => {
      const expiresAt = new Date(FIXED_NOW + 3 * 60 * 60 * 1000).toISOString();
      renderUnpaired({
        inviteToken: "TEST-LINK-TOKEN",
        tokenExpiresAt: expiresAt,
      });
      expect(screen.getByText(/expires in 3 hours/i)).toBeInTheDocument();
    });

    it("shows singular 'hour' when exactly one hour remains", () => {
      const expiresAt = new Date(FIXED_NOW + 1 * 60 * 60 * 1000).toISOString();
      renderUnpaired({
        inviteToken: "TEST-LINK-TOKEN",
        tokenExpiresAt: expiresAt,
      });
      expect(screen.getByText(/expires in 1 hour[^s]/i)).toBeInTheDocument();
    });

    it("shows minutes-based expiry when less than one hour remains", () => {
      const expiresAt = new Date(FIXED_NOW + 25 * 60 * 1000).toISOString();
      renderUnpaired({
        inviteToken: "TEST-LINK-TOKEN",
        tokenExpiresAt: expiresAt,
      });
      expect(screen.getByText(/expires in 25 minutes/i)).toBeInTheDocument();
    });

    it("shows 'Expiring soon' when less than one minute remains", () => {
      const expiresAt = new Date(FIXED_NOW + 30 * 1000).toISOString();
      renderUnpaired({
        inviteToken: "TEST-LINK-TOKEN",
        tokenExpiresAt: expiresAt,
      });
      expect(screen.getByText(/expiring soon/i)).toBeInTheDocument();
    });
  });
});

describe("LinkPartnerTab — link partner form", () => {
  it("shows a validation error when submitting with an empty token", async () => {
    renderUnpaired();
    await userEvent.click(
      screen.getByRole("button", { name: /link accounts/i }),
    );
    expect(screen.getByText(/partner token is required/i)).toBeInTheDocument();
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it("calls apiFetch with the correct endpoint and token on submit", async () => {
    mockApiFetch.mockResolvedValue({ ok: true });
    renderUnpaired();
    await userEvent.type(
      screen.getByLabelText(/partner invite token/i),
      "TEST-LINK-TOKEN",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /link accounts/i }),
    );
    expect(mockApiFetch).toHaveBeenCalledWith("/couples/link", {
      method: "POST",
      body: JSON.stringify({ token: "TEST-LINK-TOKEN" }),
    });
  });

  it("disables the submit button and shows 'Linking…' while the request is in flight", async () => {
    let resolve: (v: unknown) => void;
    mockApiFetch.mockReturnValue(new Promise((r) => (resolve = r)));
    renderUnpaired();
    await userEvent.type(
      screen.getByLabelText(/partner invite token/i),
      "TEST-LINK-TOKEN",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /link accounts/i }),
    );
    const btn = screen.getByRole("button", { name: /linking…/i });
    expect(btn).toBeDisabled();
    resolve!({ ok: true });
  });

  it("shows an API error message on a failed link attempt", async () => {
    mockApiFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Invalid or expired token" }),
    });
    renderUnpaired();
    await userEvent.type(
      screen.getByLabelText(/partner invite token/i),
      "BAD-TOKEN",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /link accounts/i }),
    );
    await screen.findByText("Invalid or expired token");
  });

  it("calls setIsPaired(true) and navigates to / on a successful link", async () => {
    mockApiFetch.mockResolvedValue({ ok: true });
    renderUnpaired();
    await userEvent.type(
      screen.getByLabelText(/partner invite token/i),
      "TEST-LINK-TOKEN",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /link accounts/i }),
    );
    await waitFor(() => expect(mockSetIsPaired).toHaveBeenCalledWith(true));
    expect(mockNavigate).toHaveBeenCalledWith("/");
  });
});
