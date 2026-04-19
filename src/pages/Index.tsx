import { useEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { LayoutGrid, LogOut, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { ChatAssistant } from "@/components/kanban/ChatAssistant";

const Index = () => {
  const { session, user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Flowboard — Your Kanban + AI assistant";
    const desc = "A beautiful Kanban board with drag-and-drop, cloud sync, and an AI assistant that knows your tasks.";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) { meta = document.createElement("meta"); meta.setAttribute("name", "description"); document.head.appendChild(meta); }
    meta.setAttribute("content", desc);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-canvas">
        <div className="h-10 w-10 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      </div>
    );
  }
  if (!session || !user) return <Navigate to="/auth" replace />;

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const initial = (user.email ?? "U").charAt(0).toUpperCase();

  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-surface/80 backdrop-blur-md">
        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg gradient-accent grid place-items-center shadow-glow">
              <LayoutGrid className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight leading-none">Flowboard</h1>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-none">Your personal Kanban</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground bg-accent-soft text-accent rounded-full px-2.5 py-1 font-medium">
              <Sparkles className="h-3 w-3" /> AI ready
            </div>
            <div className="h-8 w-8 rounded-full bg-secondary text-secondary-foreground grid place-items-center text-sm font-semibold" title={user.email ?? ""}>
              {initial}
            </div>
            <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground hover:text-foreground">
              <LogOut className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <KanbanBoard userId={user.id} />
      </main>

      <ChatAssistant />
    </div>
  );
};

export default Index;
