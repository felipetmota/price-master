import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LayoutGrid, LogOut, Shield } from "lucide-react";
import { NavLink } from "react-router-dom";

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout, isAdmin } = useAuth();
  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-[1400px] px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 font-semibold tracking-tight">
              <span className="size-2 rounded-full bg-accent" />
              Price Manager
            </div>
            <nav className="flex items-center gap-1 text-sm">
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                    isActive ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  }`
                }
              >
                <LayoutGrid className="size-3.5" /> Portal
              </NavLink>
              {isAdmin && (
                <NavLink
                  to="/admin"
                  className={({ isActive }) =>
                    `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                      isActive ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                    }`
                  }
                >
                  <Shield className="size-3.5" /> Admin
                </NavLink>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="text-right leading-tight">
              <p className="font-medium">{user?.name}</p>
              <p className="text-xs text-muted-foreground font-mono">{user?.username} · {user?.role}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut className="size-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <div className="mx-auto max-w-[1400px] px-6 py-8">{children}</div>
      </main>
    </div>
  );
}