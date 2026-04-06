import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import LinkPartnerPage from "./LinkPartnerPage";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("../lib/api", () => ({
  apiFetch: vi.fn(),
}));

const { apiFetch } = await import("../lib/api");
const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;

function mockInviteSuccess(token = "test-token-uuid") {
  mockApiFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ token, expires_at: "2026-04-09T00:00:00Z" }),
  } as Response);
}

function renderPage() {
  return render(
    <MemoryRouter>
      <LinkPartnerPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("LinkPartnerPage", () => {
  it("renders the step indicator", async () => {
    mockInviteSuccess();
    renderPage();
    expect(screen.getByText("Account")).toBeInTheDocument();
    expect(screen.getByText("Link partner")).toBeInTheDocument();
    expect(screen.getByText("Interests")).toBeInTheDocument();
  });

  it("shows loading state while fetching token", () => {
    mockApiFetch.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText(/generating your token/i)).toBeInTheDocument();
  });

  it("displays the token returned from the API", async () => {
    mockInviteSuccess("abc-123-def");
    renderPage();
    expect(await screen.findByText("abc-123-def")).toBeInTheDocument();
    expect(screen.getByText(/copy link/i)).toBeInTheDocument();
    expect(screen.getByText(/expires in 72 hours/i)).toBeInTheDocument();
  });

  it("shows an error when the invite API call fails", async () => {
    mockApiFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "You are already paired with a partner" }),
    } as Response);
    renderPage();
    expect(await screen.findByText(/already paired/i)).toBeInTheDocument();
  });

  it("renders the paste partner token section", async () => {
    mockInviteSuccess();
    renderPage();
    expect(await screen.findByText(/paste partner's token/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/xxxx-xxxx-xxxx/i)).toBeInTheDocument();
  });

  it("renders the Link accounts submit button", async () => {
    mockInviteSuccess();
    renderPage();
    expect(
      await screen.findByRole("button", { name: /link accounts/i }),
    ).toBeInTheDocument();
  });

  it("shows an error when submitted with an empty partner token", async () => {
    const user = userEvent.setup();
    mockInviteSuccess();
    renderPage();
    await screen.findByRole("button", { name: /link accounts/i });
    await user.click(screen.getByRole("button", { name: /link accounts/i }));
    expect(await screen.findByText(/required/i)).toBeInTheDocument();
  });

  it("calls POST /couples/link and navigates on success", async () => {
    const user = userEvent.setup();
    mockInviteSuccess();
    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: "Successfully linked accounts" }),
    } as Response);

    renderPage();
    await screen.findByRole("button", { name: /link accounts/i });
    await user.type(screen.getByPlaceholderText(/xxxx-xxxx-xxxx/i), "partner-token");
    await user.click(screen.getByRole("button", { name: /link accounts/i }));

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith("/couples/link", {
        method: "POST",
        body: JSON.stringify({ token: "partner-token" }),
      });
      expect(mockNavigate).toHaveBeenCalledWith("/register/interests");
    });
  });

  it("shows API error when link fails", async () => {
    const user = userEvent.setup();
    mockInviteSuccess();
    mockApiFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Invite token has expired" }),
    } as Response);

    renderPage();
    await screen.findByRole("button", { name: /link accounts/i });
    await user.type(screen.getByPlaceholderText(/xxxx-xxxx-xxxx/i), "bad-token");
    await user.click(screen.getByRole("button", { name: /link accounts/i }));

    expect(await screen.findByText(/invite token has expired/i)).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("copies the invite token to clipboard when Copy link is clicked", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      writable: true,
      configurable: true,
    });
    mockInviteSuccess("copy-me-token");
    renderPage();
    await screen.findByText(/copy link/i);
    await user.click(screen.getByText(/copy link/i));
    expect(writeText).toHaveBeenCalledWith("copy-me-token");
  });
});
