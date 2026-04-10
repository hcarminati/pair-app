import { useState, useEffect } from "react";
import { apiFetch } from "../../lib/api";

const MAX_ABOUT_US = 300;
const MAX_LOCATION = 100;

interface PairData {
  id: string;
  about_us: string | null;
  location: string | null;
}

export function CouplePreviewTab() {
  const [loading, setLoading] = useState(true);
  const [notPaired, setNotPaired] = useState(false);
  const [aboutUs, setAboutUs] = useState("");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    async function fetchPair() {
      const res = await apiFetch("/couples/me");
      if (!res.ok) {
        setNotPaired(true);
        setLoading(false);
        return;
      }
      const data = (await res.json()) as PairData;
      setAboutUs(data.about_us ?? "");
      setLocation(data.location ?? "");
      setLoading(false);
    }
    void fetchPair();
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaveSuccess(false);
    setSaveError("");

    const res = await apiFetch("/couples/me", {
      method: "PATCH",
      body: JSON.stringify({ about_us: aboutUs, location }),
    });

    setSaving(false);

    if (res.ok) {
      setSaveSuccess(true);
    } else {
      const data = (await res.json()) as { error?: string };
      setSaveError(data.error ?? "Failed to save couple profile");
    }
  }

  if (loading) {
    return <div className="profile-tab-pane">Loading couple profile…</div>;
  }

  if (notPaired) {
    return (
      <div className="profile-tab-pane">
        <p className="placeholder-text">
          You are not paired yet. Link a partner to edit your couple profile.
        </p>
      </div>
    );
  }

  return (
    <div className="profile-tab-pane">
      <div className="form-field">
        <label htmlFor="aboutUs">About us</label>
        <textarea
          id="aboutUs"
          placeholder="Tell other couples about yourselves..."
          value={aboutUs}
          maxLength={MAX_ABOUT_US}
          onChange={(e) => setAboutUs(e.target.value)}
          rows={4}
        />
        <p className="char-count">
          {aboutUs.length} / {MAX_ABOUT_US}
        </p>
      </div>

      <div className="form-field">
        <label htmlFor="coupleLocation">Location</label>
        <input
          id="coupleLocation"
          type="text"
          placeholder="City, State"
          value={location}
          maxLength={MAX_LOCATION}
          onChange={(e) => setLocation(e.target.value)}
        />
        <p className="char-count">
          {location.length} / {MAX_LOCATION}
        </p>
      </div>

      {saveSuccess && (
        <p className="form-success">Couple profile saved successfully.</p>
      )}
      {saveError && <p className="form-error">{saveError}</p>}

      <button
        type="button"
        className="btn-primary"
        onClick={() => void handleSave()}
        disabled={saving}
      >
        {saving ? "Saving…" : "Save couple profile"}
      </button>
    </div>
  );
}
