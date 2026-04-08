import { Navigate, Outlet } from "react-router-dom";
import { getAccessToken } from "../lib/authStore";

export function RequireAuth() {
  if (!getAccessToken()) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
