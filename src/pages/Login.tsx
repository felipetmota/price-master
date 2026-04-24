import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, LockKeyhole, LayoutGrid, FileSpreadsheet, ScanLine } from "lucide-react";
import getMySiteLogo from "@/assets/getmysite-logo.png";

export default function Login() {
  const { login } = useAuth();
  const { loading } = useData();
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

  return (
    <main className="min-h-screen grid lg:grid-cols-2 bg-surface">
      <section className="hidden lg:flex flex-col justify-between p-12 bg-primary text-primary-foreground">
        <div className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="size-2 rounded-full bg-accent" />
          Systems Hub
        </div>
        <div className="space-y-6 max-w-md">
          <h1 className="text-4xl font-semibold tracking-tight leading-tight">
            One sign-in. Every system you need.
          </h1>
          <p className="text-primary-foreground/70 leading-relaxed">
            Access all your internal tools from a single hub — price management, X-ray reports and more, with role-based access and full traceability.
          </p>
          <ul className="space-y-3 text-sm text-primary-foreground/70">
            <li className="flex items-center gap-2.5">
              <LayoutGrid className="size-4 text-accent" /> Unified systems hub
            </li>
            <li className="flex items-center gap-2.5">
              <FileSpreadsheet className="size-4 text-accent" /> Contract price management
            </li>
            <li className="flex items-center gap-2.5">
              <ScanLine className="size-4 text-accent" /> X-ray inspection reports
            </li>
          </ul>
        </div>
        <a
          href="https://getmysite.co.uk/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-xs text-primary-foreground/50 hover:text-primary-foreground/80 transition-colors w-fit"
        >
          <img src={getMySiteLogo} alt="GetMySite" className="size-5 rounded-sm bg-white/95 p-0.5" />
          Developed by <span className="font-medium text-primary-foreground/80">GetMySite</span>
        </a>
      </section>

      <section className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm space-y-8 animate-fade-in">
          <header className="space-y-2">
            <div className="inline-flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <LockKeyhole className="size-5" />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
            <p className="text-sm text-muted-foreground">
              Sign in to access your systems hub. Your available tools depend on the permissions assigned to your account.
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

          <p className="text-center text-xs text-muted-foreground lg:hidden">
            Developed by{" "}
            <a
              href="https://getmysite.co.uk/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground hover:text-accent transition-colors"
            >
              GetMySite
            </a>
          </p>
        </div>
      </section>
    </main>
  );
}