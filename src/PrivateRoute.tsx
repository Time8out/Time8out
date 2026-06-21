import { Navigate, Outlet } from "react-router-dom";

export default function PrivateRoute() {
  const token = sessionStorage.getItem("t8_session");

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}