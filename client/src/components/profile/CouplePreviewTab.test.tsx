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

function mockPairsResponse(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    json: async () => ({
      pair_id: "pair-id-1",
      about_us: "We love hiking",
      location: "Portland, OR",
      partner1: { display_name: "Alex Kim", about_me: "Love the outdoors", location: "Portland, OR", tags: ["hiking", "cooking"] },
      partner2: { display_name: "Jordan Lee", about_me: "Love cooking", location: "Seattle, WA", tags: ["cooking", "yoga"] },
      tags: ["cooking"],
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
    mockApiFetch.mockReturnValue(new Promise(() => {}));
    renderTab();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("renders the preview card with both partners' names and location", async () => {
    mockApiFetch.mockResolvedValueOnce(mockPairsResponse());
    renderTab();

    await waitFor(() =>
      expect(screen.getByText("Alex Kim & Jordan Lee")).toBeInTheDocument(),
    );
    // location appears in the card
    expect(screen.getAllByText("Portland, OR").length).toBeGreaterThanOrEqual(1);
  });

  it("renders initials avatars in the card", async () => {
    mockApiFetch.mockResolvedValueOnce(mockPairsResponse());
    renderTab();

    await waitFor(() =>
      expect(screen.getAllByText("AK").length).toBeGreaterThanOrEqual(1),
    );
    expect(screen.getAllByText("JL").length).toBeGreaterThanOrEqual(1);
  });

  it("renders about_us and tags in the card", async () => {
    mockApiFetch.mockResolvedValueOnce(mockPairsResponse());
    renderTab();

    // "We love hiking" appears in both the card preview and the edit textarea
    await waitFor(() =>
      expect(screen.getAllByText("We love hiking").length).toBeGreaterThanOrEqual(1),
    );
    expect(screen.getAllByText("cooking").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("hiking")).toBeInTheDocument();
    expect(screen.getByText("yoga")).toBeInTheDocument();
  });

  it("populates the edit form fields from the API response", async () => {
    mockApiFetch.mockResolvedValueOnce(mockPairsResponse());
    renderTab();

    await waitFor(() =>
      expect(screen.getByDisplayValue("We love hiking")).toBeInTheDocument(),
    );
    expect(screen.getByDisplayValue("Portland, OR")).toBeInTheDocument();
  });

  it("shows character counts for about_us and location", async () => {
    mockApiFetch.mockResolvedValueOnce(mockPairsResponse());
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

  it("renders empty edit fields when about_us and location are null", async () => {
    mockApiFetch.mockResolvedValueOnce(
      mockPairsResponse({ about_us: null, location: null }),
    );
    renderTab();

    await waitFor(() =>
      expect(
        screen.getByPlaceholderText(/tell other couples about yourselves/i),
      ).toBeInTheDocument(),
    );
    expect(screen.getByPlaceholderText(/city, state/i)).toBeInTheDocument();
  });

  it("shows not-paired message when user is not paired", async () => {
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
      .mockResolvedValueOnce(mockPairsResponse()) // GET /pairs/me
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) }); // PATCH /couples/me

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
      .mockResolvedValueOnce(mockPairsResponse())
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    const user = userEvent.setup();
    renderTab();

    await waitFor(() =>
      expect(screen.getByDisplayValue("We love hiking")).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() =>
      expect(screen.getByText(/couple profile saved/i)).toBeInTheDocument(),
    );
  });

  it("shows an error message when save fails", async () => {
    mockApiFetch
      .mockResolvedValueOnce(mockPairsResponse())
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
    const patchPromise = new Promise((r) => { resolvePatch = r; });

    mockApiFetch
      .mockResolvedValueOnce(mockPairsResponse())
      .mockReturnValueOnce(patchPromise);

    const user = userEvent.setup();
    renderTab();

    await waitFor(() =>
      expect(screen.getByDisplayValue("We love hiking")).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: /save/i }));
    expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();

    resolvePatch({ ok: true, json: async () => ({}) });
  });
});
