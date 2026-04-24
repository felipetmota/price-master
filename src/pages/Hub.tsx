import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOut, Shield, ChevronRight, Lock, Clock } from "lucide-react";
import { SYSTEMS, userCanAccess } from "@/lib/systems";

export default function Hub() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  if (!user) return <Navigate to="/" replace />;

  // Admin sees everything. Regular users only see systems they were granted.
  const visible = isAdmin
    ? SYSTEMS
    : SYSTEMS.filter((s) => userCanAccess(user, s.key) || s.status === "coming-soon" && false);
  // ^ keeps the rule strict: regular users only see systems they own.

  const open = (path: string, status: string, allowed: boolean) => {
    if (status !== "active" || !allowed) return;
    navigate(path);
  };

  return (
    <main className="min-h-screen bg-surface">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-3xl px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="size-2 rounded-full bg-accent" />
            Systems Portal
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="text-right leading-tight">
              <p className="font-medium">{user.name}</p>
              <p className="text-xs text-muted-foreground font-mono">
                {user.username} · {user.role}
              </p>
            </div>
            {isAdmin && (
              <Button variant="ghost" size="sm" onClick={() => navigate("/admin")}>
                <Shield className="size-4" /> Admin
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut className="size-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-6 py-12 animate-fade-in">
        <header className="mb-8 space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">Choose a system</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin
              ? "You have admin access to every system listed below."
              : `${visible.length} system(s) available for your account.`}
          </p>
        </header>

        {visible.length === 0 ? (
          <div className="rounded-xl border bg-card p-10 text-center">
            <Lock className="size-8 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-medium">No systems are linked to your account yet.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Ask an administrator to grant access in the Admin → Access tab.
            </p>
          </div>
        ) : (
          <ul className="rounded-xl border bg-card divide-y overflow-hidden shadow-sm">
            {visible.map((s) => {
              const allowed = isAdmin || userCanAccess(user, s.key);
              const enabled = s.status === "active" && allowed;
              const Icon = s.icon;
              return (
                <li key={s.key}>
                  <button
                    type="button"
                    onClick={() => open(s.path, s.status, allowed)}
                    disabled={!enabled}
                    className={`group w-full flex items-center gap-4 px-5 py-4 text-left transition-colors ${
                      enabled
                        ? "hover:bg-secondary/60 cursor-pointer"
                        : "opacity-60 cursor-not-allowed"
                    }`}
                  >
                    <div
                      className={`size-10 rounded-lg flex items-center justify-center shrink-0 ${
                        enabled ? "bg-accent-soft text-accent" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <Icon className="size-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{s.name}</p>
                        {s.status === "coming-soon" && (
                          <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                            <Clock className="size-3 mr-1" /> Coming soon
                          </Badge>
                        )}
                        {s.status === "active" && !allowed && (
                          <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                            <Lock className="size-3 mr-1" /> No access
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {s.description}
                      </p>
                    </div>
                    <ChevronRight
                      className={`size-4 shrink-0 transition-transform ${
                        enabled ? "text-muted-foreground group-hover:translate-x-0.5" : "text-muted-foreground/40"
                      }`}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}