import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import App from "./App";

// ChatThreadPage imports supabase directly; mock it so the module
// can be evaluated in CI where VITE_SUPABASE_URL is not set.
vi.mock("./lib/supabase", () => ({
  supabase: {
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
      send: vi.fn(),
    }),
    removeChannel: vi.fn(),
    realtime: { setAuth: vi.fn() },
  },
}));

describe("App", () => {
  it("renders LoginPage at /login", () => {
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: /log in/i })).toBeInTheDocument();
  });

  it("renders RegisterPage at /register", () => {
    render(
      <MemoryRouter initialEntries={["/register"]}>
        <App />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("button", { name: /create account/i }),
    ).toBeInTheDocument();
  });

  it("redirects unknown routes to /login", () => {
    render(
      <MemoryRouter initialEntries={["/unknown"]}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: /log in/i })).toBeInTheDocument();
  });
});
