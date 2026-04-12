import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MyProfileTab } from "./MyProfileTab";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("../../lib/api", () => ({
  apiFetch: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("../../lib/authStore", () => ({
  clearTokens: vi.fn(),
  getAccessToken: vi.fn(),
}));

const { apiFetch } = await import("../../lib/api");
const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;

function mockProfileResponse(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    json: async () => ({
      display_name: "Alex Smith",
      about_me: "Love hiking",
      location: "Portland, OR",
      email: "alex@example.com",
      tags: ["hiking", "cooking"],
      ...overrides,
    }),
  };
}

function renderTab() {
  return render(
    <MemoryRouter>
      <MyProfileTab />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("MyProfileTab", () => {
  it("shows a loading state before profile data arrives", () => {
    mockApiFetch.mockReturnValue(new Promise(() => {})); // never resolves
    renderTab();
    expect(screen.getByText(/loading profile/i)).toBeInTheDocument();
  });

  it("renders profile fields after loading", async () => {
    mockApiFetch.mockResolvedValueOnce(mockProfileResponse());
    renderTab();

    await waitFor(() =>
      expect(screen.getByDisplayValue("Alex Smith")).toBeInTheDocument(),
    );
    expect(screen.getByDisplayValue("alex@example.com")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Love hiking")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Portland, OR")).toBeInTheDocument();
  });

  it("pre-selects tags returned from the API", async () => {
    mockApiFetch.mockResolvedValueOnce(mockProfileResponse());
    renderTab();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "hiking" })).toHaveClass(
        "tag--selected",
      ),
    );
    expect(screen.getByRole("button", { name: "cooking" })).toHaveClass(
      "tag--selected",
    );
    expect(screen.getByText("2 / 10 selected")).toBeInTheDocument();
  });

  it("email field is read-only", async () => {
    mockApiFetch.mockResolvedValueOnce(mockProfileResponse());
    renderTab();

    await waitFor(() =>
      expect(screen.getByDisplayValue("alex@example.com")).toBeInTheDocument(),
    );
    expect(screen.getByDisplayValue("alex@example.com")).toHaveAttribute(
      "readonly",
    );
  });

  it("disables unselected tags once 10 are selected", async () => {
    mockApiFetch.mockResolvedValueOnce(
      mockProfileResponse({
        tags: [
          "hiking",
          "board games",
          "cooking",
          "films",
          "cycling",
          "travel",
          "yoga",
          "trivia",
          "wine",
          "running",
        ],
      }),
    );
    renderTab();

    // Wait for profile to load — all 10 preset tags selected
    await waitFor(() =>
      expect(screen.getByText("10 / 10 selected")).toBeInTheDocument(),
    );

    // Add a custom tag so there's an unselected one
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText(/add custom tag/i), "pottery");
    await user.click(screen.getByRole("button", { name: /^add$/i }));

    expect(screen.getByRole("button", { name: "pottery" })).toBeDisabled();
  });

  it("calls PATCH /profiles/me with all fields on save", async () => {
    mockApiFetch
      .mockResolvedValueOnce(mockProfileResponse()) // GET
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) }); // PATCH

    const user = userEvent.setup();
    renderTab();

    await waitFor(() =>
      expect(screen.getByDisplayValue("Alex Smith")).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: /save profile/i }));

    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/profiles/me",
        expect.objectContaining({ method: "PATCH" }),
      ),
    );

    const patchCall = mockApiFetch.mock.calls[1] as [
      string,
      { method: string; body: string },
    ];
    const body = JSON.parse(patchCall[1].body) as Record<string, unknown>;
    expect(body).toHaveProperty("display_name");
    expect(body).toHaveProperty("about_me");
    expect(body).toHaveProperty("location");
    expect(body).toHaveProperty("tags");
    expect(body).not.toHaveProperty("email");
  });

  it("shows loading state on save button while saving", async () => {
    let resolvePatch!: (v: unknown) => void;
    const patchPromise = new Promise((r) => {
      resolvePatch = r;
    });

    mockApiFetch
      .mockResolvedValueOnce(mockProfileResponse()) // GET
      .mockReturnValueOnce(patchPromise); // PATCH — never resolves until we say so

    const user = userEvent.setup();
    renderTab();

    await waitFor(() =>
      expect(screen.getByDisplayValue("Alex Smith")).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: /save profile/i }));
    expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();

    resolvePatch({ ok: true, json: async () => ({}) });
  });

  it("shows success message after a successful save", async () => {
    mockApiFetch
      .mockResolvedValueOnce(mockProfileResponse())
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    const user = userEvent.setup();
    renderTab();

    await waitFor(() =>
      expect(screen.getByDisplayValue("Alex Smith")).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: /save profile/i }));

    await waitFor(() =>
      expect(screen.getByText(/profile saved successfully/i)).toBeInTheDocument(),
    );
  });

  it("shows an error message when save fails", async () => {
    mockApiFetch
      .mockResolvedValueOnce(mockProfileResponse())
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Failed to update profile" }),
      });

    const user = userEvent.setup();
    renderTab();

    await waitFor(() =>
      expect(screen.getByDisplayValue("Alex Smith")).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: /save profile/i }));

    await waitFor(() =>
      expect(screen.getByText(/failed to update profile/i)).toBeInTheDocument(),
    );
  });
});
