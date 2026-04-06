import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import RegisterPage from "./RegisterPage";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("../lib/api", () => ({
  apiFetch: vi.fn(),
}));

vi.mock("../lib/authStore", () => ({
  setTokens: vi.fn(),
  getAccessToken: vi.fn(),
}));

const { apiFetch } = await import("../lib/api");
const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

function renderRegisterPage() {
  return render(
    <MemoryRouter>
      <RegisterPage />
    </MemoryRouter>,
  );
}

describe("RegisterPage", () => {
  it("renders a display name input field", () => {
    renderRegisterPage();
    expect(screen.getByRole("textbox", { name: /display name/i })).toBeInTheDocument();
  });

  it("renders an email input field", () => {
    renderRegisterPage();
    expect(screen.getByRole("textbox", { name: /email/i })).toBeInTheDocument();
  });

  it("renders a password input field", () => {
    renderRegisterPage();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('renders a "Create account" submit button', () => {
    renderRegisterPage();
    expect(screen.getByRole("button", { name: /create account/i })).toBeInTheDocument();
  });

  it("shows an error message when submitted with empty fields", async () => {
    const user = userEvent.setup();
    renderRegisterPage();

    const submitButton = screen.getByRole("button", { name: /create account/i });
    await user.click(submitButton);

    const errorMessage = await screen.findByText(/required/i);
    expect(errorMessage).toBeInTheDocument();
  });

  it("renders a link to the Login page (/login)", () => {
    renderRegisterPage();

    const loginLink = screen.getByRole("link", { name: /login/i });
    expect(loginLink).toBeInTheDocument();
    expect(loginLink.getAttribute("href")).toBe("/login");
  });

  it("calls apiFetch with correct args on submit", async () => {
    const user = userEvent.setup();
    mockApiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        session: { access_token: "tok", refresh_token: "ref" },
      }),
    } as Response);

    renderRegisterPage();

    await user.type(screen.getByLabelText(/display name/i), "Alice");
    await user.type(screen.getByLabelText(/email/i), "alice@example.com");
    await user.type(screen.getByLabelText(/password/i), "secret123");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(mockApiFetch).toHaveBeenCalledWith("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        displayName: "Alice",
        email: "alice@example.com",
        password: "secret123",
      }),
    });
  });

  it("redirects to /register/link-partner on successful registration", async () => {
    const user = userEvent.setup();
    mockApiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        session: { access_token: "tok", refresh_token: "ref" },
      }),
    } as Response);

    renderRegisterPage();

    await user.type(screen.getByLabelText(/display name/i), "Alice");
    await user.type(screen.getByLabelText(/email/i), "alice@example.com");
    await user.type(screen.getByLabelText(/password/i), "secret123");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/register/link-partner");
  });

  it("displays 409 duplicate email error inline", async () => {
    const user = userEvent.setup();
    mockApiFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "An account with that email already exists." }),
    } as Response);

    renderRegisterPage();

    await user.type(screen.getByLabelText(/display name/i), "Alice");
    await user.type(screen.getByLabelText(/email/i), "alice@example.com");
    await user.type(screen.getByLabelText(/password/i), "secret123");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(
      await screen.findByText(/already exists/i),
    ).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("displays generic API error inline", async () => {
    const user = userEvent.setup();
    mockApiFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Registration failed. Please try again." }),
    } as Response);

    renderRegisterPage();

    await user.type(screen.getByLabelText(/display name/i), "Alice");
    await user.type(screen.getByLabelText(/email/i), "alice@example.com");
    await user.type(screen.getByLabelText(/password/i), "secret123");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(
      await screen.findByText(/registration failed/i),
    ).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
