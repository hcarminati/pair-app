import { useState } from "react";
import { useNavigate } from "react-router-dom";
import StepIndicator from "../components/StepIndicator";
import { apiFetch } from "../lib/api";
import { normalizeTag } from "../../../shared/validation";

const STEPS = [{ label: "Account" }, { label: "Interests" }];

const PRESET_INTERESTS = [
  "hiking",
  "board games",
  "cooking",
  "films",
  "cycling",
  "travel",
  "yoga",
  "trivia",
  "wine",
  "running",
];

const MAX_INTERESTS = 10;

export default function AddInterestsPage() {
  const navigate = useNavigate();
  const [tags, setTags] = useState<string[]>(PRESET_INTERESTS);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [customTag, setCustomTag] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  function toggleTag(tag: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
      } else if (next.size < MAX_INTERESTS) {
        next.add(tag);
      }
      return next;
    });
  }

  function handleAddCustom() {
    const trimmed = normalizeTag(customTag);
    if (!trimmed || tags.includes(trimmed)) return;
    setTags((prev) => [...prev, trimmed]);
    setSelected((prev) => {
      if (prev.size < MAX_INTERESTS) return new Set([...prev, trimmed]);
      return prev;
    });
    setCustomTag("");
  }

  async function handleSubmit() {
    if (selected.size > MAX_INTERESTS) return;

    if (selected.size === 0) {
      navigate("/profile");
      return;
    }

    setSubmitting(true);
    setSubmitError("");

    try {
      const res = await apiFetch("/users/me/interests", {
        method: "PATCH",
        body: JSON.stringify({ tags: [...selected] }),
      });

      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        setSubmitError(data.error ?? "Failed to save interests");
        return;
      }

      navigate("/profile");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="onboarding-page">
      <div className="onboarding-content">
        <StepIndicator steps={STEPS} currentStep={1} />

        <div className="interest-tags">
          {tags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              disabled={!selected.has(tag) && selected.size >= MAX_INTERESTS}
              className={`tag${selected.has(tag) ? " tag--selected" : ""}`}
            >
              {tag}
            </button>
          ))}
        </div>

        <div className="custom-tag-row">
          <input
            className="onboarding-input"
            type="text"
            placeholder="Add custom tag"
            value={customTag}
            onChange={(e) => setCustomTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddCustom();
              }
            }}
          />
          <button
            type="button"
            className="btn-outlined"
            onClick={handleAddCustom}
          >
            Add
          </button>
        </div>

        <p className="interests-count">
          {selected.size} / {MAX_INTERESTS} selected
        </p>

        {submitError && <p className="form-error">{submitError}</p>}

        <button
          type="button"
          className="btn-primary"
          onClick={handleSubmit}
          disabled={selected.size > MAX_INTERESTS || submitting}
        >
          {submitting ? "Saving..." : "Save & continue"}
        </button>
      </div>
    </div>
  );
}
