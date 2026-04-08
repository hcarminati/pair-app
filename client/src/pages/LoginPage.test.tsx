import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import LoginPage from "./LoginPage";

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
  setIsPaired: vi.fn(),
  getAccessToken: vi.fn(),
}));

const { apiFetch } = await import("../lib/api");
const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

function renderLoginPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  );
}

describe("LoginPage", () => {
  it("renders an email input field", () => {
    renderLoginPage();
    expect(screen.getByRole("textbox", { name: /email/i })).toBeInTheDocument();
  });

  it("renders a password input field", () => {
    renderLoginPage();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it('renders a "Log in" submit button', () => {
    renderLoginPage();
    expect(screen.getByRole("button", { name: /log in/i })).toBeInTheDocument();
  });

  it("shows an error message when submitted with empty fields", async () => {
    const user = userEvent.setup();
    renderLoginPage();

    const submitButton = screen.getByRole("button", { name: /log in/i });
    await user.click(submitButton);

    const errorMessage = await screen.findByText(/required/i);
    expect(errorMessage).toBeInTheDocument();
  });

  it("renders a link to the Register page (/register)", () => {
    renderLoginPage();

    const registerLink = screen.getByRole("link", { name: /register/i });
    expect(registerLink).toBeInTheDocument();
    expect(registerLink.getAttribute("href")).toBe("/register");
  });

  it("calls apiFetch with correct args on submit", async () => {
    const user = userEvent.setup();
    mockApiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        session: { access_token: "tok", refresh_token: "ref" },
      }),
    } as Response);

    renderLoginPage();

    await user.type(screen.getByLabelText(/email/i), "alice@example.com");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByRole("button", { name: /log in/i }));

    expect(mockApiFetch).toHaveBeenCalledWith("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "alice@example.com", password: "secret123" }),
    });
  });

  it("redirects to / on successful login when user is paired", async () => {
    const user = userEvent.setup();
    mockApiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        session: { access_token: "tok", refresh_token: "ref" },
        partnerId: "partner-456",
      }),
    } as Response);

    renderLoginPage();

    await user.type(screen.getByLabelText(/email/i), "alice@example.com");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByRole("button", { name: /log in/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/");
  });

  it("redirects to /profile on successful login when user is not paired", async () => {
    const user = userEvent.setup();
    mockApiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        session: { access_token: "tok", refresh_token: "ref" },
        partnerId: null,
      }),
    } as Response);

    renderLoginPage();

    await user.type(screen.getByLabelText(/email/i), "alice@example.com");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByRole("button", { name: /log in/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/profile");
  });

  it("displays API error message on failed login", async () => {
    const user = userEvent.setup();
    mockApiFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Invalid email or password." }),
    } as Response);

    renderLoginPage();

    await user.type(screen.getByLabelText(/email/i), "alice@example.com");
    await user.type(screen.getByLabelText("Password"), "wrongpassword");
    await user.click(screen.getByRole("button", { name: /log in/i }));

    expect(await screen.findByText(/invalid email or password/i)).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
