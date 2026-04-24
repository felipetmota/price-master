import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { AppUser } from "@/lib/types";
import { useData } from "./DataContext";
import { userCanAccess } from "@/lib/systems";

interface AuthContextValue {
  user: AppUser | null;
  isAdmin: boolean;
  login: (username: string, password: string) => { ok: true } | { ok: false; error: string };
  logout: () => void;
  canAccess: (systemKey: string) => boolean;
  /** Replace the systems list for a given user (admin-only UI guard). */
  setUserSystems: (username: string, systems: string[]) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const STORAGE_KEY = "pm_session_user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const { users, setActor, setUsers } = useData();
  const [user, setUser] = useState<AppUser | null>(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as AppUser) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (user) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    else sessionStorage.removeItem(STORAGE_KEY);
    setActor(user?.username ?? null);
  }, [user, setActor]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isAdmin: (user?.role ?? "").toLowerCase() === "admin",
    login: (username, password) => {
      const found = users.find(
        (u) => u.username.toLowerCase() === username.trim().toLowerCase() && u.password === password,
      );
      if (!found) return { ok: false, error: "Invalid username or password." };
      setUser(found);
      return { ok: true };
    },
    logout: () => setUser(null),
    canAccess: (key) => userCanAccess(user, key),
    setUserSystems: (username, systems) => {
      const next = users.map((u) =>
        u.username.toLowerCase() === username.toLowerCase() ? { ...u, systems } : u,
      );
      setUsers(next);
      // If we just updated the logged-in user, refresh session copy too.
      if (user && user.username.toLowerCase() === username.toLowerCase()) {
        setUser({ ...user, systems });
      }
    },
  }), [user, users, setUsers]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}