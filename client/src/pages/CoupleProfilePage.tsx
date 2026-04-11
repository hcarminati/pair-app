import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../lib/api";

interface PartnerInfo {
  display_name: string;
  about_me: string | null;
  location: string | null;
  tags: string[];
}

interface CoupleProfile {
  pair_id: string;
  about_us: string | null;
  location: string | null;
  partner1: PartnerInfo;
  partner2: PartnerInfo;
  tags: string[];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return name.slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function AvatarPair({
  initials1,
  initials2,
  size = "md",
}: {
  initials1: string;
  initials2: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass =
    size === "lg" ? "avatar--lg" : size === "sm" ? "avatar--sm" : "avatar--md";
  return (
    <div className="avatar-pair">
      <div className={`avatar ${sizeClass}`}>{initials1}</div>
      <div className={`avatar ${sizeClass} avatar--overlap`}>{initials2}</div>
    </div>
  );
}

export default function CoupleProfilePage() {
  const [loading, setLoading] = useState(true);
  const [notPaired, setNotPaired] = useState(false);
  const [profile, setProfile] = useState<CoupleProfile | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      const res = await apiFetch("/pairs/me");
      if (!res.ok) {
        setNotPaired(true);
        setLoading(false);
        return;
      }
      const data = (await res.json()) as CoupleProfile;
      setProfile(data);
      setLoading(false);
    }
    void fetchProfile();
  }, []);

  if (loading) {
    return (
      <div className="discovery-page">
        <p className="text-muted">Loading couple profile…</p>
      </div>
    );
  }

  if (notPaired || !profile) {
    return (
      <div className="discovery-page">
        <div className="discovery-header">
          <h1>Couple Profile</h1>
        </div>
        <div className="discovery-unlinked">
          <div className="discovery-unlinked-box">
            <p>No couple profile yet</p>
            <p className="discovery-unlinked-hint">
              Link with a partner to see your couple profile
            </p>
          </div>
        </div>
      </div>
    );
  }

  const initials1 = getInitials(profile.partner1.display_name);
  const initials2 = getInitials(profile.partner2.display_name);

  return (
    <div className="discovery-page">
      <div className="discovery-modal-header">
        <div className="couple-card-identity">
          <AvatarPair initials1={initials1} initials2={initials2} size="lg" />
          <div>
            <h1>
              {profile.partner1.display_name} &amp;{" "}
              {profile.partner2.display_name}
            </h1>
            {profile.location && (
              <p className="discovery-subtitle">{profile.location}</p>
            )}
          </div>
        </div>
      </div>

      {profile.about_us && (
        <div className="discovery-modal-section">
          <h3>About us</h3>
          <p className="text-muted">{profile.about_us}</p>
        </div>
      )}

      {profile.tags.length > 0 && (
        <div className="discovery-modal-section">
          <h3>Interests</h3>
          <div className="interest-pills">
            {profile.tags.map((tag) => (
              <span key={tag} className="pill pill--sm">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="discovery-modal-section">
        <h3>Partners</h3>
        <div className="couple-grid">
          <div className="couple-card couple-card--static">
            <div className="couple-card-header">
              <div className="couple-card-identity">
                <div className="avatar avatar--md">{initials1}</div>
                <span className="couple-names">{profile.partner1.display_name}</span>
              </div>
            </div>
            <p className="discovery-subtitle">
              {profile.partner1.location ?? "No location set"}
            </p>
            <p className="text-muted">
              {profile.partner1.about_me ?? "No bio yet"}
            </p>
            {profile.partner1.tags.length > 0 && (
              <div className="interest-pills" style={{ marginTop: 12 }}>
                {profile.partner1.tags.map((tag) => (
                  <span key={tag} className="pill pill--sm">{tag}</span>
                ))}
              </div>
            )}
          </div>
          <div className="couple-card couple-card--static">
            <div className="couple-card-header">
              <div className="couple-card-identity">
                <div className="avatar avatar--md">{initials2}</div>
                <span className="couple-names">{profile.partner2.display_name}</span>
              </div>
            </div>
            <p className="discovery-subtitle">
              {profile.partner2.location ?? "No location set"}
            </p>
            <p className="text-muted">
              {profile.partner2.about_me ?? "No bio yet"}
            </p>
            {profile.partner2.tags.length > 0 && (
              <div className="interest-pills" style={{ marginTop: 12 }}>
                {profile.partner2.tags.map((tag) => (
                  <span key={tag} className="pill pill--sm">{tag}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <Link to="/profile" className="btn btn--secondary">
        Edit couple profile
      </Link>
    </div>
  );
}
