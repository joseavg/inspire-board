// Board-aware AI assistant with tool-calling for the Kanban board.
// Streams SSE responses back to the client.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a delightful, vibrant AI assistant embedded in a personal Kanban board with three columns: "todo", "in_progress", and "done". 🎯

You can read the user's tasks and help them organize their work by:
- 💬 Answering questions and summarizing what's on the board
- 🧭 Suggesting priorities and next steps
- ✨ Creating, updating (editing any field — title, description, status, priority, tags, due date), moving, or deleting tasks via tools

Rules:
- Be concise, warm, and friendly. Sprinkle in tasteful emojis 🎉✨📝⚡✅ to make responses feel alive — but don't overdo it.
- Use markdown (bold, lists) for clarity.
- Status values: only "todo", "in_progress", or "done".
- Priority values: only "low", "medium", "high".
- When the user asks you to do something on the board, USE THE APPROPRIATE TOOL. Don't just describe — act. To edit an existing task, use update_task with its id.
- After tool calls, briefly confirm what you did with a friendly emoji.
- For dates, use ISO 8601 format (YYYY-MM-DD).
- When the user marks something done or you move it to done, celebrate with 🎉.`;

const tools = [
  {
    type: "function",
    function: {
      name: "create_task",
      description: "Create a new task on the board",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          status: { type: "string", enum: ["todo", "in_progress", "done"] },
          priority: { type: "string", enum: ["low", "medium", "high"] },
          tags: { type: "array", items: { type: "string" } },
          due_date: { type: "string", description: "ISO date YYYY-MM-DD or null" },
        },
        required: ["title"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_task",
      description: "Update fields of an existing task. Use this to edit ANY field of an existing task: title, description, status, priority, tags, or due_date.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          status: { type: "string", enum: ["todo", "in_progress", "done"] },
          priority: { type: "string", enum: ["low", "medium", "high"] },
          tags: { type: "array", items: { type: "string" } },
          due_date: { type: "string" },
        },
        required: ["id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_task",
      description: "Delete a task by ID",
      parameters: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
        additionalProperties: false,
      },
    },
  },
];

async function executeTool(name: string, args: any, supabase: any, userId: string) {
  try {
    if (name === "create_task") {
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          user_id: userId,
          title: args.title,
          description: args.description ?? null,
          status: args.status ?? "todo",
          priority: args.priority ?? "medium",
          tags: args.tags ?? [],
          due_date: args.due_date ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return { ok: true, task: data };
    }
    if (name === "update_task") {
      const { id, ...rest } = args;
      const { data, error } = await supabase
        .from("tasks")
        .update(rest)
        .eq("id", id)
        .eq("user_id", userId)
        .select()
        .single();
      if (error) throw error;
      return { ok: true, task: data };
    }
    if (name === "delete_task") {
      const { error } = await supabase
        .from("tasks")
        .delete()
        .eq("id", args.id)
        .eq("user_id", userId);
      if (error) throw error;
      return { ok: true };
    }
    return { ok: false, error: "Unknown tool" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const { messages } = await req.json();

    // Snapshot the board for context
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, title, description, status, priority, tags, due_date")
      .eq("user_id", userId)
      .order("position");
    const boardContext = `Current board snapshot (${tasks?.length ?? 0} tasks):\n${JSON.stringify(tasks ?? [], null, 2)}`;

    const conversation: any[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "system", content: boardContext },
      ...messages,
    ];

    // Loop: handle tool calls until model returns plain text, then stream final answer.
    for (let iter = 0; iter < 6; iter++) {
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: conversation,
          tools,
          stream: false,
        }),
      });

      if (!resp.ok) {
        if (resp.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit reached. Please wait a moment and try again." }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (resp.status === 402) {
          return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in Settings → Workspace → Usage." }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const t = await resp.text();
        console.error("Gateway error", resp.status, t);
        return new Response(JSON.stringify({ error: "AI gateway error" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await resp.json();
      const choice = data.choices?.[0];
      const msg = choice?.message;
      if (!msg) throw new Error("No message returned");

      const toolCalls = msg.tool_calls;
      if (toolCalls && toolCalls.length > 0) {
        conversation.push(msg);
        for (const call of toolCalls) {
          const args = JSON.parse(call.function.arguments || "{}");
          const result = await executeTool(call.function.name, args, supabase, userId);
          conversation.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify(result),
          });
        }
        continue;
      }

      // Final answer — stream it back as SSE.
      const text = msg.content ?? "";
      const stream = new ReadableStream({
        start(controller) {
          const enc = new TextEncoder();
          // Chunk by ~6 chars for a typing feel
          const chunks = text.match(/[\s\S]{1,6}/g) ?? [text];
          let i = 0;
          const interval = setInterval(() => {
            if (i >= chunks.length) {
              controller.enqueue(enc.encode(`data: [DONE]\n\n`));
              controller.close();
              clearInterval(interval);
              return;
            }
            const payload = { choices: [{ delta: { content: chunks[i] } }] };
            controller.enqueue(enc.encode(`data: ${JSON.stringify(payload)}\n\n`));
            i++;
          }, 12);
        },
      });

      return new Response(stream, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    return new Response(JSON.stringify({ error: "Too many tool iterations" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("kanban-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
