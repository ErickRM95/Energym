import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ExerciseRow = { id: string; name: string; muscle_group: string; equipment: string | null; difficulty: string };

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: request.headers.get("Authorization") ?? "" } } },
  );
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return json({ error: "Not authenticated" }, 401);

  const body = await request.json();
  const { data: profile } = await supabase.from("profiles").select("id, role, organization_id").eq("id", auth.user.id).single();
  if (!profile?.organization_id) return json({ error: "Profile has no organization" }, 403);

  const memberId = String(body.memberId ?? "");
  const staff = ["trainer", "gym_admin", "super_admin"].includes(profile.role);
  if (!staff && memberId !== profile.id) return json({ error: "Forbidden" }, 403);

  const { data: organization } = await supabase.from("organizations").select("ai_routines_enabled").eq("id", profile.organization_id).single();
  if (!staff && !organization?.ai_routines_enabled) return json({ error: "AI routines are disabled" }, 403);

  const [{ data: exercises }, { data: measurement }, { data: member }] = await Promise.all([
    supabase.from("exercises_library").select("id, name, muscle_group, equipment, difficulty").eq("is_active", true),
    supabase.from("body_measurements").select("weight_kg, body_fat_pct, height_cm, notes").eq("member_id", memberId).order("recorded_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("profiles").select("medical_notes").eq("id", memberId).maybeSingle(),
  ]);
  const catalog = (exercises ?? []) as ExerciseRow[];
  if (catalog.length === 0) return json({ error: "Exercise catalog is empty" }, 400);

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return json({ error: "GEMINI_API_KEY is not configured" }, 500);

  const prompt = [
    "Devuelve solo JSON con name, goal y days.",
    "Cada day tiene day_number, name, focus_area y exercises.",
    "Cada exercise usa solo un exercise_id del catálogo, order_index, sets, reps, rest_seconds, target_rpe y trainer_notes.",
    `Objetivo ${body.goal}. Días ${body.daysPerWeek}. Nivel ${body.experience}. Minutos ${body.sessionMinutes}.`,
    `Ficha del cliente: ${member?.medical_notes || "sin notas"}.`,
    `Restricciones adicionales: ${body.injuries || "ninguna"}. Medidas: ${JSON.stringify(measurement ?? {})}.`,
    "Adapta la rutina al peso, tamaño, lesiones, enfermedades y demás notas de la ficha. Evita ejercicios que choquen con esas limitaciones.",
    `Catálogo: ${JSON.stringify(catalog)}.`,
  ].join("\n");
  let response = await askGemini(apiKey, prompt, "gemini-3.5-flash-lite");
  if (response.status === 404) response = await askGemini(apiKey, prompt, "gemini-3.8-flash");
  if (!response.ok) {
    const raw = await response.text();
    const detail = raw.replace(/key=[^&\s"]+/gi, "key=redacted").slice(0, 500);
    return json({ error: "Gemini request failed", status: response.status, detail }, 502);
  }

  const payload = await response.json();
  const parts = payload?.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((part: { text?: string }) => part.text ?? "").filter(Boolean).join("\n");
  if (!text) return json({ error: "Gemini returned an empty draft" }, 502);
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) return json({ error: "Gemini returned an empty draft" }, 502);
  const draft = JSON.parse(text.slice(start, end + 1)) as { days?: Array<{ exercises?: Array<{ exercise_id: string; sets: number; rest_seconds: number }> }> };
  const allowedIds = new Set(catalog.map((exercise) => exercise.id));
  for (const day of draft.days ?? []) {
    for (const exercise of day.exercises ?? []) {
      if (!allowedIds.has(exercise.exercise_id) || exercise.sets < 1 || exercise.rest_seconds < 0) {
        return json({ error: "Gemini prescribed an exercise outside the catalog" }, 422);
      }
    }
  }
  return json({ draft });
});

function askGemini(apiKey: string, prompt: string, model: string) {
  return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" },
    }),
  });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
