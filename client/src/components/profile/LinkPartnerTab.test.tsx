import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LinkPartnerTab } from "./LinkPartnerTab";

vi.mock("../../lib/api", () => ({ apiFetch: vi.fn() }));
vi.mock("../../lib/authStore", () => ({ setIsPaired: vi.fn() }));

function renderPaired(onUnlink = vi.fn()) {
  return render(
    <MemoryRouter>
      <LinkPartnerTab
        paired
        inviteToken={null}
        tokenExpiresAt={null}
        tokenLoading={false}
        tokenError=""
        onUnlink={onUnlink}
      />
    </MemoryRouter>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe("LinkPartnerTab — unlink confirmation", () => {
  it("shows Unlink partner button when paired", () => {
    renderPaired();
    expect(screen.getByRole("button", { name: /unlink partner/i })).toBeInTheDocument();
  });

  it("shows confirmation UI after clicking Unlink partner", async () => {
    renderPaired();
    await userEvent.click(screen.getByRole("button", { name: /unlink partner/i }));
    expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /yes, unlink/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("does not call onUnlink when clicking Unlink partner", async () => {
    const onUnlink = vi.fn();
    renderPaired(onUnlink);
    await userEvent.click(screen.getByRole("button", { name: /unlink partner/i }));
    expect(onUnlink).not.toHaveBeenCalled();
  });

  it("cancels confirmation and returns to initial state", async () => {
    renderPaired();
    await userEvent.click(screen.getByRole("button", { name: /unlink partner/i }));
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.getByRole("button", { name: /unlink partner/i })).toBeInTheDocument();
    expect(screen.queryByText(/are you sure/i)).not.toBeInTheDocument();
  });

  it("calls onUnlink when confirming", async () => {
    const onUnlink = vi.fn().mockResolvedValue(undefined);
    renderPaired(onUnlink);
    await userEvent.click(screen.getByRole("button", { name: /unlink partner/i }));
    await userEvent.click(screen.getByRole("button", { name: /yes, unlink/i }));
    await waitFor(() => expect(onUnlink).toHaveBeenCalledOnce());
  });
});
