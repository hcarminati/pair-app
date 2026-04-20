import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { CoupleDetailModal } from "./CoupleDetailModal";

const FIXTURE_RESULT = {
  pair_id: "pair-1",
  about_us: "Active couple who love hiking.",
  location: "Denver, CO",
  tags: ["hiking", "cycling", "films"],
  matching_tags: ["hiking", "cycling"],
  shared_count: 2,
  partner1: {
    display_name: "Morgan",
    about_me: "I love the mountains.",
    location: "Denver, CO",
    tags: ["hiking", "cycling"],
  },
  partner2: {
    display_name: "Casey",
    about_me: "Film buff.",
    location: "Denver, CO",
    tags: ["films", "cycling"],
  },
};

const FIXTURE_COUPLE = {
  id: "pair-1",
  names: "Morgan & Casey",
  initials1: "MO",
  initials2: "CA",
  inCommon: 2,
  interests: ["hiking", "cycling", "films"],
  matching: ["hiking", "cycling"],
  description: "Active couple who love hiking.",
  location: "Denver, CO",
};

describe("CoupleDetailModal", () => {
  it("renders the couple names in the modal header", () => {
    render(
      <CoupleDetailModal
        result={FIXTURE_RESULT}
        couple={FIXTURE_COUPLE}
        isInterested={false}
        onClose={vi.fn()}
        onInterested={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("heading", { name: /morgan & casey/i }),
    ).toBeInTheDocument();
  });

  it("renders the couple location in the modal header", () => {
    render(
      <CoupleDetailModal
        result={FIXTURE_RESULT}
        couple={FIXTURE_COUPLE}
        isInterested={false}
        onClose={vi.fn()}
        onInterested={vi.fn()}
      />,
    );
    // Location appears at least once (may appear multiple times due to partner locations)
    expect(screen.getAllByText("Denver, CO").length).toBeGreaterThan(0);
  });

  it("renders the about us section when present", () => {
    render(
      <CoupleDetailModal
        result={FIXTURE_RESULT}
        couple={FIXTURE_COUPLE}
        isInterested={false}
        onClose={vi.fn()}
        onInterested={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("heading", { name: /about us/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Active couple who love hiking."),
    ).toBeInTheDocument();
  });

  it("does not render about us section when absent", () => {
    const resultNoAbout = { ...FIXTURE_RESULT, about_us: null };
    render(
      <CoupleDetailModal
        result={resultNoAbout}
        couple={FIXTURE_COUPLE}
        isInterested={false}
        onClose={vi.fn()}
        onInterested={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole("heading", { name: /about us/i }),
    ).not.toBeInTheDocument();
  });

  it("renders the interests section with shared count", () => {
    render(
      <CoupleDetailModal
        result={FIXTURE_RESULT}
        couple={FIXTURE_COUPLE}
        isInterested={false}
        onClose={vi.fn()}
        onInterested={vi.fn()}
      />,
    );
    expect(screen.getByText(/2 interests in common/i)).toBeInTheDocument();
  });

  it("renders singular 'interest' for shared_count of 1", () => {
    const resultOne = { ...FIXTURE_RESULT, shared_count: 1 };
    render(
      <CoupleDetailModal
        result={resultOne}
        couple={FIXTURE_COUPLE}
        isInterested={false}
        onClose={vi.fn()}
        onInterested={vi.fn()}
      />,
    );
    expect(screen.getByText(/1 interest in common/i)).toBeInTheDocument();
  });

  it("renders all interest tags as pills", () => {
    render(
      <CoupleDetailModal
        result={FIXTURE_RESULT}
        couple={FIXTURE_COUPLE}
        isInterested={false}
        onClose={vi.fn()}
        onInterested={vi.fn()}
      />,
    );
    // Tags appear at least once (may appear multiple times due to partner cards)
    expect(screen.getAllByText("hiking").length).toBeGreaterThan(0);
    expect(screen.getAllByText("cycling").length).toBeGreaterThan(0);
    expect(screen.getAllByText("films").length).toBeGreaterThan(0);
  });

  it("marks matching tags with pill--active class", () => {
    render(
      <CoupleDetailModal
        result={FIXTURE_RESULT}
        couple={FIXTURE_COUPLE}
        isInterested={false}
        onClose={vi.fn()}
        onInterested={vi.fn()}
      />,
    );
    // In the shared interests section, matching tags have pill--active.
    // hiking is a matching tag — at least one pill with that text should have pill--active.
    const hikingPills = screen.getAllByText("hiking");
    expect(
      hikingPills.some((el) => el.classList.contains("pill--active")),
    ).toBe(true);
    // films is NOT a matching tag — no pill with that text in the interests section should have pill--active.
    // (Partner card pills don't get pill--active either.)
    const filmsPills = screen.getAllByText("films");
    expect(
      filmsPills.every((el) => !el.classList.contains("pill--active")),
    ).toBe(true);
  });

  it("renders per-partner section with Partners heading", () => {
    render(
      <CoupleDetailModal
        result={FIXTURE_RESULT}
        couple={FIXTURE_COUPLE}
        isInterested={false}
        onClose={vi.fn()}
        onInterested={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("heading", { name: /partners/i }),
    ).toBeInTheDocument();
  });

  it("renders each partner's name, bio, and location", () => {
    render(
      <CoupleDetailModal
        result={FIXTURE_RESULT}
        couple={FIXTURE_COUPLE}
        isInterested={false}
        onClose={vi.fn()}
        onInterested={vi.fn()}
      />,
    );
    expect(screen.getAllByText("Morgan").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Casey").length).toBeGreaterThan(0);
    expect(screen.getByText("I love the mountains.")).toBeInTheDocument();
    expect(screen.getByText("Film buff.")).toBeInTheDocument();
  });

  it("renders 'No bio yet' when partner about_me is null", () => {
    const resultNoBio = {
      ...FIXTURE_RESULT,
      partner1: { ...FIXTURE_RESULT.partner1, about_me: null },
    };
    render(
      <CoupleDetailModal
        result={resultNoBio}
        couple={FIXTURE_COUPLE}
        isInterested={false}
        onClose={vi.fn()}
        onInterested={vi.fn()}
      />,
    );
    expect(screen.getByText("No bio yet")).toBeInTheDocument();
  });

  it("renders 'No location set' when partner location is null", () => {
    const resultNoLoc = {
      ...FIXTURE_RESULT,
      partner1: { ...FIXTURE_RESULT.partner1, location: null },
    };
    render(
      <CoupleDetailModal
        result={resultNoLoc}
        couple={FIXTURE_COUPLE}
        isInterested={false}
        onClose={vi.fn()}
        onInterested={vi.fn()}
      />,
    );
    expect(screen.getByText("No location set")).toBeInTheDocument();
  });

  it("renders the CTA button with 'I'm interested' when not interested", () => {
    render(
      <CoupleDetailModal
        result={FIXTURE_RESULT}
        couple={FIXTURE_COUPLE}
        isInterested={false}
        onClose={vi.fn()}
        onInterested={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: /i'm interested/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /i'm interested/i }),
    ).not.toBeDisabled();
  });

  it("renders the CTA button disabled with 'Interested' when already interested", () => {
    render(
      <CoupleDetailModal
        result={FIXTURE_RESULT}
        couple={FIXTURE_COUPLE}
        isInterested={true}
        onClose={vi.fn()}
        onInterested={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: /^interested$/i }),
    ).toBeDisabled();
  });

  it("calls onInterested when CTA button is clicked", async () => {
    const onInterested = vi.fn();
    render(
      <CoupleDetailModal
        result={FIXTURE_RESULT}
        couple={FIXTURE_COUPLE}
        isInterested={false}
        onClose={vi.fn()}
        onInterested={onInterested}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /i'm interested/i }),
    );
    expect(onInterested).toHaveBeenCalledOnce();
  });

  it("calls onClose when the close button is clicked", async () => {
    const onClose = vi.fn();
    render(
      <CoupleDetailModal
        result={FIXTURE_RESULT}
        couple={FIXTURE_COUPLE}
        isInterested={false}
        onClose={onClose}
        onInterested={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /×/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when the overlay backdrop is clicked", async () => {
    const onClose = vi.fn();
    render(
      <CoupleDetailModal
        result={FIXTURE_RESULT}
        couple={FIXTURE_COUPLE}
        isInterested={false}
        onClose={onClose}
        onInterested={vi.fn()}
      />,
    );
    // Click the overlay element (the outer backdrop div)
    const overlay = document.querySelector(".discovery-modal-overlay");
    expect(overlay).not.toBeNull();
    await userEvent.click(overlay!);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not call onClose when clicking inside the modal content", async () => {
    const onClose = vi.fn();
    render(
      <CoupleDetailModal
        result={FIXTURE_RESULT}
        couple={FIXTURE_COUPLE}
        isInterested={false}
        onClose={onClose}
        onInterested={vi.fn()}
      />,
    );
    const modal = document.querySelector(".discovery-modal");
    expect(modal).not.toBeNull();
    await userEvent.click(modal!);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not show a CTA section when hideCta is true", () => {
    render(
      <CoupleDetailModal
        result={FIXTURE_RESULT}
        couple={FIXTURE_COUPLE}
        isInterested={false}
        onClose={vi.fn()}
        onInterested={vi.fn()}
        hideCta
      />,
    );
    expect(
      screen.queryByRole("button", { name: /interested/i }),
    ).not.toBeInTheDocument();
  });
});
