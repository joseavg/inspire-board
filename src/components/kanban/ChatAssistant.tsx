import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Sparkles, Send, X, Loader2, Bot, User as UserIcon, Mic, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Msg = { role: "user" | "assistant"; content: string };

interface Props {
  onTasksChanged?: () => void;
}

export function ChatAssistant({ onTasksChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Hey there! ✨ I'm your board assistant. Ask me anything, or tell me what to do — like *“add 3 tasks for launch prep 🚀”*, *“edit the design task to high priority”*, or *“mark the bug fix as done ✅”*.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const userMsg: Msg = { role: "user", content: text };
    setMessages((p) => [...p, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("Not signed in");

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/kanban-chat`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!resp.ok) {
        if (resp.status === 429) toast.error("Rate limit reached. Try again soon.");
        else if (resp.status === 402) toast.error("AI credits exhausted. Add more in workspace settings.");
        else toast.error("Assistant unavailable");
        setLoading(false);
        return;
      }
      if (!resp.body) throw new Error("No stream");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantText = "";
      setMessages((p) => [...p, { role: "assistant", content: "" }]);

      let done = false;
      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") { done = true; break; }
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantText += delta;
              setMessages((p) => p.map((m, i) => (i === p.length - 1 ? { ...m, content: assistantText } : m)));
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
      // Refresh board in case the assistant modified tasks
      onTasksChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        if (blob.size === 0) { setTranscribing(false); return; }
        try {
          setTranscribing(true);
          const buf = await blob.arrayBuffer();
          const bytes = new Uint8Array(buf);
          let bin = "";
          const chunk = 0x8000;
          for (let i = 0; i < bytes.length; i += chunk) {
            bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
          }
          const base64 = btoa(bin);
          const { data, error } = await supabase.functions.invoke("transcribe-voice", {
            body: { audio: base64, mimeType: mr.mimeType || "audio/webm" },
          });
          if (error) throw error;
          const text = (data as { text?: string })?.text?.trim();
          if (text) setInput((p) => (p ? p + " " : "") + text);
          else toast.info("Didn't catch that — try again");
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Transcription failed");
        } finally {
          setTranscribing(false);
        }
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
    } catch {
      toast.error("Microphone access denied");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  return (
    <>
      {/* Floating launcher */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full gradient-accent text-accent-foreground shadow-glow grid place-items-center transition-spring hover:scale-105 active:scale-95",
          open && "scale-90 opacity-0 pointer-events-none"
        )}
        aria-label="Open AI assistant"
      >
        <Sparkles className="h-6 w-6" />
      </button>

      {/* Panel */}
      <div
        className={cn(
          "fixed z-40 bg-surface border border-border shadow-lifted rounded-2xl flex flex-col overflow-hidden transition-spring",
          "bottom-6 right-6 w-[min(420px,calc(100vw-3rem))] h-[min(620px,calc(100vh-3rem))]",
          open ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-accent-soft/60 to-transparent">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg gradient-accent grid place-items-center">
              <Sparkles className="h-4 w-4 text-accent-foreground" />
            </div>
            <div>
              <div className="text-sm font-semibold leading-tight">Board Assistant</div>
              <div className="text-[11px] text-muted-foreground leading-tight">Knows your tasks · can act</div>
            </div>
          </div>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={cn("flex gap-2.5 animate-fade-in", m.role === "user" && "flex-row-reverse")}>
              <div
                className={cn(
                  "h-7 w-7 shrink-0 rounded-full grid place-items-center text-xs",
                  m.role === "user" ? "bg-secondary text-secondary-foreground" : "gradient-accent text-accent-foreground"
                )}
              >
                {m.role === "user" ? <UserIcon className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
              </div>
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-secondary text-secondary-foreground rounded-tl-sm"
                )}
              >
                {m.role === "assistant" ? (
                  <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-headings:my-2 prose-strong:text-current prose-a:text-accent">
                    <ReactMarkdown>{m.content || "…"}</ReactMarkdown>
                  </div>
                ) : (
                  <span className="whitespace-pre-wrap">{m.content}</span>
                )}
              </div>
            </div>
          ))}
          {loading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex gap-2.5 animate-fade-in">
              <div className="h-7 w-7 shrink-0 rounded-full gradient-accent text-accent-foreground grid place-items-center">
                <Bot className="h-3.5 w-3.5" />
              </div>
              <div className="bg-secondary rounded-2xl rounded-tl-sm px-3.5 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="p-3 border-t border-border bg-surface">
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder={recording ? "Listening… 🎙️" : transcribing ? "Transcribing…" : "Ask, type or speak…"}
              rows={1}
              disabled={transcribing}
              className="resize-none min-h-[42px] max-h-32 bg-secondary/50 border-border focus-visible:ring-accent"
            />
            <Button
              size="icon"
              onClick={recording ? stopRecording : startRecording}
              disabled={loading || transcribing}
              variant={recording ? "destructive" : "secondary"}
              className={cn(
                "h-10 w-10 shrink-0 transition-spring",
                recording && "animate-pulse"
              )}
              aria-label={recording ? "Stop recording" : "Start voice input"}
            >
              {transcribing ? <Loader2 className="h-4 w-4 animate-spin" /> : recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
            <Button
              size="icon"
              onClick={send}
              disabled={loading || !input.trim() || recording || transcribing}
              className="h-10 w-10 gradient-accent text-accent-foreground border-0 shrink-0 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
