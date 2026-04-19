import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { LayoutGrid, Sparkles } from "lucide-react";

export default function Auth() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!loading && session) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Welcome aboard! Setting up your board…");
        navigate("/");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back");
        navigate("/");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-6 overflow-hidden bg-canvas">
      {/* Decorative gradient orbs */}
      <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-accent/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-[hsl(var(--tag-2))]/30 blur-3xl" />

      <div className="relative grid w-full max-w-5xl grid-cols-1 lg:grid-cols-2 gap-10 items-center">
        {/* Left: brand */}
        <div className="hidden lg:block animate-fade-in">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-11 w-11 rounded-xl gradient-accent grid place-items-center shadow-glow">
              <LayoutGrid className="h-6 w-6 text-accent-foreground" />
            </div>
            <span className="text-xl font-semibold tracking-tight">Flowboard</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight leading-tight">
            A calmer way to <span className="bg-clip-text text-transparent gradient-accent">ship work</span>.
          </h1>
          <p className="mt-4 text-muted-foreground text-lg leading-relaxed max-w-md">
            Drag, drop, and let an AI co-pilot organize your tasks. Saved instantly to the cloud — pick up right where you left off.
          </p>
          <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 text-accent" />
            <span>Includes a board-aware AI assistant</span>
          </div>
        </div>

        {/* Right: form */}
        <Card className="p-8 shadow-lifted border-border/60 animate-scale-in">
          <div className="lg:hidden flex items-center gap-2 mb-6">
            <div className="h-9 w-9 rounded-lg gradient-accent grid place-items-center">
              <LayoutGrid className="h-5 w-5 text-accent-foreground" />
            </div>
            <span className="font-semibold">Flowboard</span>
          </div>

          <h2 className="text-2xl font-semibold tracking-tight">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "signin" ? "Sign in to your board" : "Start organizing in seconds"}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
              />
            </div>
            <Button type="submit" disabled={submitting} className="w-full gradient-accent text-accent-foreground border-0 shadow-glow hover:opacity-90">
              {submitting ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signin" ? "Don't have an account?" : "Already have one?"}{" "}
            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="text-accent font-medium hover:underline"
            >
              {mode === "signin" ? "Sign up" : "Sign in"}
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
