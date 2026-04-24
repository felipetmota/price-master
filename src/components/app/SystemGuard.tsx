import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Route guard that ensures the current user is authenticated and has been
 * granted access to the given system key (admins always pass).
 * Sends unauthenticated users to /login and unauthorized users back to /hub.
 */
export default function SystemGuard({
  systemKey,
  children,
}: {
  systemKey: string;
  children: ReactNode;
}) {
  const { user, canAccess } = useAuth();
  if (!user) return <Navigate to="/" replace />;
  if (!canAccess(systemKey)) return <Navigate to="/" replace />;
  return <>{children}</>;
}