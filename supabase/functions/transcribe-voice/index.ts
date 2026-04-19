import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BodySchema = z.object({
  audio: z.string().min(1, "Missing audio"),
  mimeType: z.string().optional(),
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) {
      return json({ error: "Voice transcription is not configured yet." }, 500);
    }

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return json({ error: parsed.error.flatten().fieldErrors.audio?.[0] ?? "Invalid request" }, 400);
    }

    const { audio, mimeType } = parsed.data;

    const binary = atob(audio);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const blob = new Blob([bytes], { type: mimeType || "audio/webm" });
    const form = new FormData();
    form.append("file", blob, "audio.webm");
    form.append("model_id", "scribe_v2");

    const resp = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": ELEVENLABS_API_KEY },
      body: form,
    });

    if (!resp.ok) {
      const detailText = await resp.text();
      console.error("ElevenLabs error", resp.status, detailText);

      if (resp.status === 401) {
        return json({
          error: "Voice transcription is blocked by the speech provider on the current plan. Try again without VPN/proxy or upgrade the provider plan.",
          code: "PROVIDER_AUTH_BLOCKED",
          fallback: true,
        });
      }

      if (resp.status >= 500) {
        return json({
          error: "Voice transcription is temporarily unavailable. Please try again in a moment.",
          code: "PROVIDER_UNAVAILABLE",
          fallback: true,
        });
      }

      return json({
        error: "Voice transcription failed.",
        code: "TRANSCRIPTION_FAILED",
      }, resp.status);
    }

    const data = await resp.json();
    return json({ text: data.text ?? "" });
  } catch (e) {
    console.error("transcribe-voice error:", e);
    return json({
      error: "Voice transcription is temporarily unavailable. Please try again in a moment.",
      code: "SERVICE_FAILED",
      fallback: true,
    });
  }
});
