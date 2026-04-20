import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import StepIndicator from "./StepIndicator";

const STEPS = [
  { label: "Account" },
  { label: "Link partner" },
  { label: "Interests" },
];

describe("StepIndicator", () => {
  it("renders all step labels", () => {
    render(<StepIndicator steps={STEPS} currentStep={0} />);
    expect(screen.getByText("Account")).toBeInTheDocument();
    expect(screen.getByText("Link partner")).toBeInTheDocument();
    expect(screen.getByText("Interests")).toBeInTheDocument();
  });

  it("shows numbers for active and future steps", () => {
    render(<StepIndicator steps={STEPS} currentStep={1} />);
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("does not show a number for a completed step", () => {
    render(<StepIndicator steps={STEPS} currentStep={1} />);
    expect(screen.queryByText("1")).not.toBeInTheDocument();
  });

  it("shows no completed steps when on the first step", () => {
    render(<StepIndicator steps={STEPS} currentStep={0} />);
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows all steps as complete except the last when on the last step", () => {
    render(<StepIndicator steps={STEPS} currentStep={2} />);
    expect(screen.queryByText("1")).not.toBeInTheDocument();
    expect(screen.queryByText("2")).not.toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });
});
