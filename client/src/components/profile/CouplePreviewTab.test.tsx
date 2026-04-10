import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CouplePreviewTab } from "./CouplePreviewTab";

vi.mock("../../lib/api", () => ({
  apiFetch: vi.fn(),
}));

const { apiFetch } = await import("../../lib/api");
const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;

function mockPairResponse(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    json: async () => ({
      id: "pair-id-1",
      profile_id_1: "user-a",
      profile_id_2: "user-b",
      about_us: "We love hiking",
      location: "Portland, OR",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      ...overrides,
    }),
  };
}

function renderTab() {
  return render(
    <MemoryRouter>
      <CouplePreviewTab />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CouplePreviewTab", () => {
  it("shows a loading state before data arrives", () => {
    mockApiFetch.mockReturnValue(new Promise(() => {})); // never resolves
    renderTab();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("renders about_us and location fields after loading", async () => {
    mockApiFetch.mockResolvedValueOnce(mockPairResponse());
    renderTab();

    await waitFor(() =>
      expect(screen.getByDisplayValue("We love hiking")).toBeInTheDocument(),
    );
    expect(screen.getByDisplayValue("Portland, OR")).toBeInTheDocument();
  });

  it("shows character counts for about_us and location", async () => {
    mockApiFetch.mockResolvedValueOnce(mockPairResponse());
    renderTab();

    await waitFor(() =>
      expect(screen.getByDisplayValue("We love hiking")).toBeInTheDocument(),
    );

    // "We love hiking".length === 14, "Portland, OR".length === 12
    expect(
      screen.getByText((_, el) => el?.textContent?.trim() === "14 / 300"),
    ).toBeInTheDocument();
    expect(
      screen.getByText((_, el) => el?.textContent?.trim() === "12 / 100"),
    ).toBeInTheDocument();
  });

  it("renders empty fields when about_us and location are null", async () => {
    mockApiFetch.mockResolvedValueOnce(
      mockPairResponse({ about_us: null, location: null }),
    );
    renderTab();

    await waitFor(() =>
      expect(
        screen.getByPlaceholderText(/tell other couples about yourselves/i),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByPlaceholderText(/city, state/i),
    ).toBeInTheDocument();
  });

  it("shows not-paired message when user is not paired (400)", async () => {
    mockApiFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: "You are not currently paired" }),
    });
    renderTab();

    await waitFor(() =>
      expect(screen.getByText(/not paired/i)).toBeInTheDocument(),
    );
  });

  it("calls PATCH /couples/me with updated fields on save", async () => {
    mockApiFetch
      .mockResolvedValueOnce(mockPairResponse()) // GET
      .mockResolvedValueOnce({ ok: true, json: async () => mockPairResponse().json() }); // PATCH

    const user = userEvent.setup();
    renderTab();

    await waitFor(() =>
      expect(screen.getByDisplayValue("We love hiking")).toBeInTheDocument(),
    );

    const aboutUs = screen.getByDisplayValue("We love hiking");
    await user.clear(aboutUs);
    await user.type(aboutUs, "We love cooking");

    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/couples/me",
        expect.objectContaining({ method: "PATCH" }),
      ),
    );

    const patchCall = mockApiFetch.mock.calls[1] as [
      string,
      { method: string; body: string },
    ];
    const body = JSON.parse(patchCall[1].body) as Record<string, unknown>;
    expect(body).toHaveProperty("about_us", "We love cooking");
    expect(body).toHaveProperty("location", "Portland, OR");
  });

  it("shows success message after a successful save", async () => {
    mockApiFetch
      .mockResolvedValueOnce(mockPairResponse())
      .mockResolvedValueOnce({ ok: true, json: async () => mockPairResponse().json() });

    const user = userEvent.setup();
    renderTab();

    await waitFor(() =>
      expect(screen.getByDisplayValue("We love hiking")).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() =>
      expect(
        screen.getByText(/couple profile saved/i),
      ).toBeInTheDocument(),
    );
  });

  it("shows an error message when save fails", async () => {
    mockApiFetch
      .mockResolvedValueOnce(mockPairResponse())
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Failed to update couple profile" }),
      });

    const user = userEvent.setup();
    renderTab();

    await waitFor(() =>
      expect(screen.getByDisplayValue("We love hiking")).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() =>
      expect(
        screen.getByText(/failed to update couple profile/i),
      ).toBeInTheDocument(),
    );
  });

  it("shows loading state on save button while saving", async () => {
    let resolvePatch!: (v: unknown) => void;
    const patchPromise = new Promise((r) => {
      resolvePatch = r;
    });

    mockApiFetch
      .mockResolvedValueOnce(mockPairResponse())
      .mockReturnValueOnce(patchPromise);

    const user = userEvent.setup();
    renderTab();

    await waitFor(() =>
      expect(screen.getByDisplayValue("We love hiking")).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: /save/i }));
    expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();

    resolvePatch({ ok: true, json: async () => mockPairResponse().json() });
  });
});
