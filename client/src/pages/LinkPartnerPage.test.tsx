import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import LinkPartnerPage from "./LinkPartnerPage";

function renderPage() {
  return render(
    <MemoryRouter>
      <LinkPartnerPage />
    </MemoryRouter>
  );
}

describe("LinkPartnerPage", () => {
  it("renders the step indicator", () => {
    renderPage();
    expect(screen.getByText("Account")).toBeInTheDocument();
    expect(screen.getByText("Link partner")).toBeInTheDocument();
    expect(screen.getByText("Interests")).toBeInTheDocument();
  });

  it("renders the invite token section", () => {
    renderPage();
    expect(screen.getByText(/your invite token/i)).toBeInTheDocument();
    expect(screen.getByText(/copy link/i)).toBeInTheDocument();
    expect(screen.getByText(/expires in 72 hours/i)).toBeInTheDocument();
  });

  it("renders the paste partner token section", () => {
    renderPage();
    expect(screen.getByText(/paste partner's token/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/xxxx-xxxx-xxxx/i)).toBeInTheDocument();
  });

  it("renders the Link accounts submit button", () => {
    renderPage();
    expect(screen.getByRole("button", { name: /link accounts/i })).toBeInTheDocument();
  });

  it("shows an error when submitted with an empty partner token", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: /link accounts/i }));
    expect(await screen.findByText(/required/i)).toBeInTheDocument();
  });

  it("clears the error when a token is entered and submitted", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: /link accounts/i }));
    expect(await screen.findByText(/required/i)).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText(/xxxx-xxxx-xxxx/i), "abcd-1234-efgh");
    await user.click(screen.getByRole("button", { name: /link accounts/i }));
    expect(screen.queryByText(/required/i)).not.toBeInTheDocument();
  });

  it("copies the invite token to clipboard when Copy link is clicked", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      writable: true,
      configurable: true,
    });
    renderPage();
    await user.click(screen.getByText(/copy link/i));
    expect(writeText).toHaveBeenCalledOnce();
  });
});
