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

beforeEach(() => {
  vi.clearAllMocks();
  mockApiFetch.mockResolvedValue({ ok: true });
});

function renderPage() {
  return render(
    <MemoryRouter>
      <AddInterestsPage />
    </MemoryRouter>,
  );
}

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

  it("calls PATCH /profiles/me with selected tags on submit", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: "hiking" }));
    await user.click(screen.getByRole("button", { name: "cooking" }));
    await user.click(screen.getByRole("button", { name: /save & continue/i }));

    expect(mockApiFetch).toHaveBeenCalledWith("/profiles/me", {
      method: "PATCH",
      body: expect.stringContaining('"tags"'),
    });

    const body = JSON.parse(
      (mockApiFetch.mock.calls[0] as [string, { body: string }])[1].body,
    ) as { tags: string[] };
    expect(body.tags).toContain("hiking");
    expect(body.tags).toContain("cooking");
    expect(body.tags).toHaveLength(2);
  });

  it("navigates to /profile after submit", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: /save & continue/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/profile");
  });
});
