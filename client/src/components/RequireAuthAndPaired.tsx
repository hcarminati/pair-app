import { Navigate, Outlet } from "react-router-dom";
import { getAccessToken, getIsPaired } from "../lib/authStore";

export function RequireAuthAndPaired() {
  if (!getAccessToken()) {
    return <Navigate to="/login" replace />;
  }
  if (!getIsPaired()) {
    return <Navigate to="/profile" replace />;
  }
  return <Outlet />;
}
