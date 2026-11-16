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
  const attempt = await askModels(apiKey, prompt);
  if (!attempt.response) {
    return json({ draft: catalogDraft(catalog, body), source: "catalog" });
  }
  const response = attempt.response;

  const payload = await response.json();
  const parts = payload?.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((part: { text?: string }) => part.text ?? "").filter(Boolean).join("\n");
  if (!text) return json({ error: "Gemini returned an empty draft" }, 502);
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) return json({ error: "Gemini returned an empty draft" }, 502);
  let draft: { days?: Array<{ exercises?: Array<{ exercise_id: string; sets: number; rest_seconds: number }> }> };
  try {
    draft = JSON.parse(text.slice(start, end + 1));
  } catch {
    return json({ error: "Gemini returned an empty draft" }, 502);
  }
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

const geminiModels = ["gemini-3.5-flash-lite", "gemini-3.8-flash"];

async function askModels(apiKey: string, prompt: string) {
  let status = 502;
  let detail = "";
  const attempts: Array<{ model: string; status: number }> = [];
  for (const model of geminiModels) {
    try {
      const response = await askGemini(apiKey, prompt, model);
      if (response.ok) return { response, status: response.status, detail: "", attempts };
      status = response.status;
      attempts.push({ model, status });
      detail = (await response.text()).replace(/key=[^&\s"]+/gi, "key=redacted").slice(0, 300);
      if (status === 401 || status === 403) break;
    } catch (error) {
      status = 408;
      attempts.push({ model, status });
      detail = error instanceof Error ? error.name : "timeout";
    }
  }
  return { status, detail, attempts };
}

function askGemini(apiKey: string, prompt: string, model: string) {
  return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    signal: AbortSignal.timeout(22_000),
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" },
    }),
  });
}

function catalogDraft(catalog: ExerciseRow[], body: { goal?: string; daysPerWeek?: number; experience?: string; sessionMinutes?: number; injuries?: string }) {
  const goal = String(body.goal ?? "fuerza");
  const experience = String(body.experience ?? "beginner");
  const notes = String(body.injuries ?? "").toLowerCase();
  const dayCount = Math.min(7, Math.max(1, Number(body.daysPerWeek) || 3));
  const exerciseCount = Math.min(6, Math.max(4, Math.round((Number(body.sessionMinutes) || 60) / 12)));
  const maxRank = experience === "advanced" ? 2 : experience === "intermediate" ? 1 : 0;
  const sequences = [
    ["full"],
    ["upper", "lower"],
    ["push", "pull", "legs"],
    ["upper", "lower", "upper", "lower"],
    ["push", "pull", "legs", "upper", "lower"],
    ["push", "pull", "legs", "push", "pull", "legs"],
    ["push", "pull", "legs", "upper", "lower", "full", "core"],
  ];
  const muscles: Record<string, string[]> = {
    push: ["Pecho", "Hombros", "Brazos"],
    pull: ["Espalda", "Brazos", "Posteriores"],
    legs: ["Piernas", "Glúteos", "Posteriores", "Core"],
    upper: ["Pecho", "Espalda", "Hombros", "Brazos"],
    lower: ["Piernas", "Glúteos", "Posteriores", "Core"],
    full: ["Piernas", "Pecho", "Espalda", "Core", "Hombros"],
    core: ["Core", "Glúteos", "Cardio"],
  };
  const titles: Record<string, [string, string]> = {
    push: ["Empuje", "Pecho y hombros"],
    pull: ["Tirón", "Espalda"],
    legs: ["Piernas", "Tren inferior"],
    upper: ["Tren superior", "Pecho y espalda"],
    lower: ["Tren inferior", "Piernas y glúteos"],
    full: ["Cuerpo completo", "Cuerpo completo"],
    core: ["Core", "Abdomen y estabilidad"],
  };
  const prescription = {
    hipertrofia: { sets: 3, reps: "8-12", rest: 90, rpe: 7 },
    fuerza: { sets: 4, reps: "4-6", rest: 150, rpe: 8 },
    perdida_de_grasa: { sets: 3, reps: "12-15", rest: 45, rpe: 7 },
    resistencia: { sets: 2, reps: "15-20", rest: 30, rpe: 6 },
  }[goal] ?? { sets: 3, reps: "8-12", rest: 90, rpe: 7 };
  const sets = experience === "beginner" ? Math.max(2, prescription.sets - 1) : prescription.sets;
  const goalName = { hipertrofia: "Hipertrofia", perdida_de_grasa: "Pérdida de grasa", fuerza: "Fuerza", resistencia: "Resistencia" }[goal] ?? "Fuerza";
  const used = new Set<string>();

  function allowed(exercise: ExerciseRow) {
    const rank = exercise.difficulty === "advanced" ? 2 : exercise.difficulty === "intermediate" ? 1 : 0;
    return rank <= maxRank;
  }

  function blocked(exercise: ExerciseRow) {
    const name = exercise.name.toLowerCase();
    const rules: Array<[string, string[]]> = [
      ["rodilla", ["sentadilla", "zancada", "prensa"]],
      ["hombro", ["militar", "fondos"]],
      ["lumbar", ["peso muerto"]],
      ["muneca", ["press de banca", "militar"]],
      ["muñeca", ["press de banca", "militar"]],
    ];
    return rules.some(([word, names]) => notes.includes(word) && names.some((piece) => name.includes(piece)));
  }

  function pick(focus: string[]) {
    const preferred = catalog.filter((exercise) => !used.has(exercise.id) && !blocked(exercise) && allowed(exercise));
    const pool = preferred.length > 0 ? preferred : catalog.filter((exercise) => !used.has(exercise.id) && !blocked(exercise));
    const source = pool.length > 0 ? pool : catalog;
    const picked: ExerciseRow[] = [];
    for (const muscle of focus) {
      const match = source.find((exercise) => exercise.muscle_group === muscle && !picked.includes(exercise));
      if (match) picked.push(match);
      if (picked.length >= exerciseCount) break;
    }
    for (const exercise of source) {
      if (picked.length >= exerciseCount) break;
      if (!picked.includes(exercise)) picked.push(exercise);
    }
    for (const exercise of picked) used.add(exercise.id);
    if (used.size >= catalog.length) used.clear();
    return picked;
  }

  return {
    name: `Rutina de ${goalName}`,
    goal,
    days: sequences[dayCount - 1].map((split, index) => {
      const [name, focus] = titles[split];
      return {
        day_number: index + 1,
        name: `Día ${index + 1} · ${name}`,
        focus_area: focus,
        exercises: pick(muscles[split]).map((exercise, order) => ({
          exercise_id: exercise.id,
          order_index: order,
          sets,
          reps: prescription.reps,
          rest_seconds: prescription.rest,
          target_rpe: prescription.rpe,
          trainer_notes: null,
        })),
      };
    }),
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
