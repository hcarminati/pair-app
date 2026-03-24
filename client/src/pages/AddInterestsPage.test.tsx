import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import AddInterestsPage from "./AddInterestsPage";

function renderPage() {
  return render(
    <MemoryRouter>
      <AddInterestsPage />
    </MemoryRouter>
  );
}

describe("AddInterestsPage", () => {
  it("renders the step indicator", () => {
    renderPage();
    expect(screen.getByText("Account")).toBeInTheDocument();
    expect(screen.getByText("Link partner")).toBeInTheDocument();
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
    const presets = ["hiking", "board games", "cooking", "films", "cycling",
                     "travel", "yoga", "trivia", "wine", "running"];
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
    await user.type(screen.getByPlaceholderText(/add custom tag/i), "pottery{Enter}");
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
    expect(screen.getByRole("button", { name: /save & continue/i })).toBeInTheDocument();
  });
});
