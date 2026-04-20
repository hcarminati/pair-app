import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import AddInterestsPage from "./pages/AddInterestsPage";
import ProfilePage from "./pages/ProfilePage";
import CoupleProfilePage from "./pages/CoupleProfilePage";
import DiscoveryPage from "./pages/DiscoveryPage";
import InboundRequestsPage from "./pages/InboundRequestsPage";
import PartnerInterestsPage from "./pages/PartnerInterestsPage";
import ConnectionsPage from "./pages/ConnectionsPage";
import { RequireAuth } from "./components/RequireAuth";
import { RequireAuthAndPaired } from "./components/RequireAuthAndPaired";

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Auth only — onboarding step (no app shell) */}
      <Route element={<RequireAuth />}>
        <Route path="/register/interests" element={<AddInterestsPage />} />
      </Route>

      {/* Auth only — app shell */}
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/couple-profile" element={<CoupleProfilePage />} />
        </Route>
      </Route>

      {/* Auth + paired — app shell */}
      <Route element={<RequireAuthAndPaired />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DiscoveryPage isLinked={true} />} />
          <Route path="/inbound-requests" element={<InboundRequestsPage />} />
          <Route path="/partner-interests" element={<PartnerInterestsPage />} />
          <Route path="/connections" element={<ConnectionsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
