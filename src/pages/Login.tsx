import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, LockKeyhole } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const { loading, users } = useData();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const res = await login(username, password);
    setSubmitting(false);
    if (res.ok === true) {
      toast.success("Welcome.");
    } else {
      toast.error(res.error);
    }
  };

  const fillCredentials = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    toast.message("Credentials filled — click Sign in.");
  };

  return (
    <main className="min-h-screen grid lg:grid-cols-2 bg-surface">
      <section className="hidden lg:flex flex-col justify-between p-12 bg-primary text-primary-foreground">
        <div className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="size-2 rounded-full bg-accent" />
          Price Manager
        </div>
        <div className="space-y-6 max-w-md">
          <h1 className="text-4xl font-semibold tracking-tight leading-tight">
            Contract price management, without the noise.
          </h1>
          <p className="text-primary-foreground/70 leading-relaxed">
            Register price breaks, import spreadsheets and apply bulk updates by item or supplier — all with control and traceability.
          </p>
          <ul className="space-y-2 text-sm text-primary-foreground/60">
            <li>— Direct Excel import</li>
            <li>— Bulk edit by percentage or fixed value</li>
            <li>— Advanced filters on every field</li>
          </ul>
        </div>
        <p className="text-xs text-primary-foreground/40">Test environment · in-memory data</p>
      </section>

      <section className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm space-y-8 animate-fade-in">
          <header className="space-y-2">
            <div className="inline-flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <LockKeyhole className="size-5" />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
            <p className="text-sm text-muted-foreground">
              Sign in with the test credentials defined in the <span className="font-mono">users</span> sheet.
            </p>
          </header>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input id="username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={loading || submitting}>
              {loading ? (<><Loader2 className="size-4 animate-spin" /> Loading data…</>) : "Sign in"}
            </Button>
          </form>

          {users.length > 0 && (
            <div className="rounded-lg border bg-card p-4 space-y-3">
              <div>
                <p className="text-sm font-medium text-foreground">Test credentials</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Click an option below to auto-fill, then click <span className="font-medium text-foreground">Sign in</span>.
                </p>
              </div>
              <div className="grid gap-2">
                {users.slice(0, 2).map((u) => (
                  <button
                    key={u.username}
                    type="button"
                    onClick={() => fillCredentials(u.username, u.password)}
                    className="flex items-center justify-between rounded-md border bg-background px-3 py-2 text-left transition-colors hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <span className="font-mono text-xs text-foreground">
                      {u.username} / {u.password}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {u.role}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}