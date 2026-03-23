import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import RegisterPage from "./RegisterPage";

describe("RegisterPage", () => {
  it("renders a display name input field", () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );
    expect(screen.getByRole("textbox", { name: /display name/i })).toBeDefined();
  });

  it("renders an email input field", () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );
    expect(screen.getByRole("textbox", { name: /email/i })).toBeDefined();
  });

  it("renders a password input field", () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );
    expect(screen.getByLabelText(/password/i)).toBeDefined();
  });

  it('renders a "Create account" submit button', () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );
    expect(screen.getByRole("button", { name: /create account/i })).toBeDefined();
  });

  it("shows an error message when submitted with empty fields", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );
    
    const submitButton = screen.getByRole("button", { name: /create account/i });
    await user.click(submitButton);

    const errorMessage = await screen.findByText(/required/i);
    expect(errorMessage).toBeDefined();
  });

  it("renders a link to the Login page (/login)", () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );
    
    const loginLink = screen.getByRole("link", { name: /login/i });
    expect(loginLink).toBeDefined();
    expect(loginLink.getAttribute("href")).toBe("/login");
  });
});
