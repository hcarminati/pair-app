import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import AddInterestsPage from "./AddInterestsPage";

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

function renderPage() {
  return render(
    <MemoryRouter>
      <AddInterestsPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AddInterestsPage", () => {
  it("renders the step indicator", () => {
    renderPage();
    expect(screen.getByText("Account")).toBeInTheDocument();
    expect(screen.getByText("Interests")).toBeInTheDocument();
  });

  it("renders preset interest tags", () => {
    renderPage();
    expect(screen.getByRole("button", { name: "hiking" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "cooking" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "films" })).toBeInTheDocument();
  });

  it("shows 0 / 10 selected initially", () => {
    renderPage();
    expect(screen.getByText("0 / 10 selected")).toBeInTheDocument();
  });

  it("selects a tag when clicked and updates the counter", async () => {
    const user = userEvent.setup();
    renderPage();
    const tag = screen.getByRole("button", { name: "hiking" });
    await user.click(tag);
    expect(tag).toHaveClass("tag--selected");
    expect(screen.getByText("1 / 10 selected")).toBeInTheDocument();
  });

  it("deselects a tag when clicked again", async () => {
    const user = userEvent.setup();
    renderPage();
    const tag = screen.getByRole("button", { name: "hiking" });
    await user.click(tag);
    await user.click(tag);
    expect(tag).not.toHaveClass("tag--selected");
    expect(screen.getByText("0 / 10 selected")).toBeInTheDocument();
  });

  it("does not select more than 10 tags", async () => {
    const user = userEvent.setup();
    renderPage();
    const presets = [
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
    ];
    for (const tag of presets) {
      await user.click(screen.getByRole("button", { name: tag }));
    }
    expect(screen.getByText("10 / 10 selected")).toBeInTheDocument();
  });

  it("disables unselected tags when 10 are selected", async () => {
    const user = userEvent.setup();
    renderPage();
    // Select all 10 preset tags first
    const presets = [
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
    ];
    for (const tag of presets) {
      await user.click(screen.getByRole("button", { name: tag }));
    }
    expect(screen.getByText("10 / 10 selected")).toBeInTheDocument();
    // Adding a custom tag at the limit does not auto-select it, so it should be disabled
    await user.type(screen.getByPlaceholderText(/add custom tag/i), "pottery");
    await user.click(screen.getByRole("button", { name: /^add$/i }));
    expect(screen.getByRole("button", { name: "pottery" })).toBeDisabled();
  });

  it("adds a custom tag and auto-selects it", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByPlaceholderText(/add custom tag/i), "pottery");
    await user.click(screen.getByRole("button", { name: /^add$/i }));
    const newTag = screen.getByRole("button", { name: "pottery" });
    expect(newTag).toBeInTheDocument();
    expect(newTag).toHaveClass("tag--selected");
  });

  it("clears the custom tag input after adding", async () => {
    const user = userEvent.setup();
    renderPage();
    const input = screen.getByPlaceholderText(/add custom tag/i);
    await user.type(input, "pottery");
    await user.click(screen.getByRole("button", { name: /^add$/i }));
    expect(input).toHaveValue("");
  });

  it("adds a custom tag when Enter is pressed", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(
      screen.getByPlaceholderText(/add custom tag/i),
      "pottery{Enter}",
    );
    expect(screen.getByRole("button", { name: "pottery" })).toBeInTheDocument();
  });

  it("does not add a duplicate custom tag", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByPlaceholderText(/add custom tag/i), "hiking");
    await user.click(screen.getByRole("button", { name: /^add$/i }));
    expect(screen.getAllByRole("button", { name: "hiking" })).toHaveLength(1);
  });

  it("renders the Save & continue button", () => {
    renderPage();
    expect(
      screen.getByRole("button", { name: /save & continue/i }),
    ).toBeInTheDocument();
  });

  it("navigates directly to /profile when no tags are selected", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: /save & continue/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/profile");
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it("calls PATCH /users/me/interests and navigates to /profile on success", async () => {
    const user = userEvent.setup();
    mockApiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ tags: ["hiking"] }),
    } as Response);

    renderPage();
    await user.click(screen.getByRole("button", { name: "hiking" }));
    await user.click(screen.getByRole("button", { name: /save & continue/i }));

    expect(mockApiFetch).toHaveBeenCalledWith("/users/me/interests", {
      method: "PATCH",
      body: JSON.stringify({ tags: ["hiking"] }),
    });
    expect(mockNavigate).toHaveBeenCalledWith("/profile");
  });

  it("shows inline error and does not navigate on API failure", async () => {
    const user = userEvent.setup();
    mockApiFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Failed to save interests" }),
    } as Response);

    renderPage();
    await user.click(screen.getByRole("button", { name: "hiking" }));
    await user.click(screen.getByRole("button", { name: /save & continue/i }));

    expect(
      await screen.findByText(/failed to save interests/i),
    ).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("shows loading state on submit button while request is in flight", async () => {
    const user = userEvent.setup();
    mockApiFetch.mockImplementation(() => new Promise(() => {})); // never resolves

    renderPage();
    await user.click(screen.getByRole("button", { name: "hiking" }));
    await user.click(screen.getByRole("button", { name: /save & continue/i }));

    expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();
  });
});
