import { useState, useEffect, useRef } from "react";
import { getIsPaired, setIsPaired } from "../lib/authStore";
import { apiFetch } from "../lib/api";
import { useNavigate } from "react-router-dom";
import { MyProfileTab } from "../components/profile/MyProfileTab";
import { LinkPartnerTab } from "../components/profile/LinkPartnerTab";
import { CouplePreviewTab } from "../components/profile/CouplePreviewTab";

type Tab = "my-profile" | "link-partner" | "couple-preview";

const TABS: { id: Tab; label: string }[] = [
  { id: "my-profile", label: "My profile" },
  { id: "link-partner", label: "Link partner" },
  { id: "couple-preview", label: "Couple preview" },
];

export default function ProfilePage() {
  const navigate = useNavigate();
  const [paired, setPaired] = useState(getIsPaired());
  const [activeTab, setActiveTab] = useState<Tab>(
    paired ? "my-profile" : "link-partner",
  );
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [tokenExpiresAt, setTokenExpiresAt] = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState(!paired);
  const [tokenError, setTokenError] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (paired) return;
    async function fetchInviteToken() {
      const res = await apiFetch("/couples/invite", { method: "POST" });
      const data = (await res.json()) as {
        token?: string;
        expires_at?: string;
        error?: string;
      };
      if (!res.ok) {
        setTokenError(data.error ?? "Failed to generate invite token");
      } else if (data.token) {
        setInviteToken(data.token);
        setTokenExpiresAt(data.expires_at ?? null);
      }
      setTokenLoading(false);
    }
    void fetchInviteToken();
  }, [paired]);

  // Poll so the token creator gets navigated to / when the other person links
  useEffect(() => {
    if (paired) return;
    pollRef.current = setInterval(async () => {
      const res = await apiFetch("/auth/me");
      if (!res.ok) return;
      const data = (await res.json()) as { partnerId: string | null };
      if (data.partnerId) {
        clearInterval(pollRef.current!);
        setIsPaired(true);
        navigate("/");
      }
    }, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [paired, navigate]);

  async function handleUnlink() {
    const res = await apiFetch("/couples/link", { method: "DELETE" });
    if (!res.ok) return;
    setIsPaired(false);
    setPaired(false);
    setInviteToken(null);
    setTokenExpiresAt(null);
    setTokenError("");
    setTokenLoading(true);
    setActiveTab("link-partner");
  }

  return (
    <div className="profile-page">
      <div className="profile-tabs">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={`profile-tab${activeTab === id ? " profile-tab--active" : ""}`}
            onClick={() => setActiveTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {activeTab === "my-profile" && <MyProfileTab />}
      {activeTab === "link-partner" && (
        <LinkPartnerTab
          paired={paired}
          inviteToken={inviteToken}
          tokenExpiresAt={tokenExpiresAt}
          tokenLoading={tokenLoading}
          tokenError={tokenError}
          onUnlink={handleUnlink}
        />
      )}
      {activeTab === "couple-preview" && <CouplePreviewTab />}
    </div>
  );
}
