import { Navigate } from "react-router-dom";
import { ReactNode } from "react";

interface ProtectedRouteProps {
  user: any;
  children: ReactNode;
}

export default function ProtectedRoute({
  user,
  children,
}: ProtectedRouteProps) {
  if (!user) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
