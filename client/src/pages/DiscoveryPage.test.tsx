import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import DiscoveryPage from "./DiscoveryPage";

describe("DiscoveryPage", () => {
  it("renders the page heading", () => {
    render(
      <MemoryRouter>
        <DiscoveryPage />
      </MemoryRouter>
    );
    expect(screen.getByRole("heading", { name: /discover couples/i })).toBeInTheDocument();
  });

  it("displays couples ranked by shared tag count descending", () => {
    render(
      <MemoryRouter>
        <DiscoveryPage />
      </MemoryRouter>
    );
    const counts = screen
      .getAllByText(/in common/i)
      .map((el) => parseInt(el.textContent ?? "0"));
    for (let i = 0; i < counts.length - 1; i++) {
      expect(counts[i]).toBeGreaterThanOrEqual(counts[i + 1]);
    }
  });

  it("shows the shared tag count on each couple card", () => {
    render(
      <MemoryRouter>
        <DiscoveryPage />
      </MemoryRouter>
    );
    const badges = screen.getAllByText(/in common/i);
    expect(badges.length).toBeGreaterThan(0);
  });

  it("renders filter pills", () => {
    render(
      <MemoryRouter>
        <DiscoveryPage />
      </MemoryRouter>
    );
    expect(screen.getByRole("button", { name: /hiking/i })).toBeInTheDocument();
  });

  it("renders an 'I'm interested' button on each card", () => {
    render(
      <MemoryRouter>
        <DiscoveryPage />
      </MemoryRouter>
    );
    const buttons = screen.getAllByRole("button", { name: /i'm interested/i });
    expect(buttons.length).toBeGreaterThan(0);
  });
});
