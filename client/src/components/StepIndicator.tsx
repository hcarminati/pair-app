interface Step {
  label: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;
}

export default function StepIndicator({
  steps,
  currentStep,
}: StepIndicatorProps) {
  return (
    <div className="step-indicator">
      {steps.map((step, i) => (
        <div key={step.label} className="step-indicator__item">
          {i > 0 && <div className="step-connector" />}
          <div className="step-item">
            <div
              className={[
                "step-circle",
                i < currentStep
                  ? "step-circle--done"
                  : i === currentStep
                    ? "step-circle--active"
                    : "step-circle--inactive",
              ].join(" ")}
            >
              {i < currentStep ? (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M3 8l3.5 3.5L13 5"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <span>{i + 1}</span>
              )}
            </div>
            <span
              className={`step-label${i > currentStep ? " step-label--inactive" : ""}`}
            >
              {step.label}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
