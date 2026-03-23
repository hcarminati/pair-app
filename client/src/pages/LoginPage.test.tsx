import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import LoginPage from "./LoginPage";

describe("LoginPage", () => {
  it("renders an email input field", () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );
    expect(screen.getByRole("textbox", { name: /email/i })).toBeDefined();
  });

  it("renders a password input field", () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );
    expect(screen.getByLabelText(/password/i)).toBeDefined();
  });

  it('renders a "Log in" submit button', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );
    expect(screen.getByRole("button", { name: /log in/i })).toBeDefined();
  });

  it("shows an error message when submitted with empty fields", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );
    
    const submitButton = screen.getByRole("button", { name: /log in/i });
    await user.click(submitButton);

    const errorMessage = await screen.findByText(/required/i);
    expect(errorMessage).toBeDefined();
  });

  it("renders a link to the Register page (/register)", () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );
    
    const registerLink = screen.getByRole("link", { name: /register/i });
    expect(registerLink).toBeDefined();
    expect(registerLink.getAttribute("href")).toBe("/register");
  });
});
