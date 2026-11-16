"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { RoutineDraft } from "@energym/shared";
import { saveRoutine } from "@/app/actions";
import { Button, Card, Field, Input, Select, TextArea } from "@/components/ui";
import { catalogRoutine } from "@/lib/catalog-routine";
import { createClient } from "@/lib/supabase/browser";

async function geminiFailure(error: unknown) {
  const context = error && typeof error === "object" && "context" in error ? (error as { context?: { json?: () => Promise<unknown> } }).context : undefined;
  const body = context?.json ? await context.json().catch(() => null) : null;
  const detail = body && typeof body === "object" && "detail" in body ? String((body as { detail?: unknown }).detail ?? "") : "";
  const status = body && typeof body === "object" && "status" in body ? Number((body as { status?: unknown }).status) : 0;
  if (detail.includes("API key not valid") || detail.includes("ACCESS_TOKEN_TYPE_UNSUPPORTED")) {
    return "La clave de Gemini no sirve para esta API. En AI Studio creá una clave clásica y guardala otra vez como GEMINI_API_KEY.";
  }
  if (status === 404 || detail.includes("NOT_FOUND")) {
    return "El modelo de Gemini ya no está disponible para esta clave. Volvé a publicar la función.";
  }
  if (status === 408 || status === 503 || status === 429 || detail.includes("high demand") || detail.includes("UNAVAILABLE") || detail.includes("Timeout")) {
    return "Gemini está saturado en este momento. Espera un momento y vuelve a generar.";
  }
  return "Gemini no respondió. Puedes armar la rutina a mano.";
}

function asDraft(draft: RoutineDraft): RoutineDraft {
  return {
    ...draft,
    days: draft.days.map((day) => ({
      ...day,
      focus_area: day.focus_area || "General",
      exercises: day.exercises.map((exercise) => ({
        ...exercise,
        reps: String(exercise.reps),
        sets: Number(exercise.sets) || 1,
        rest_seconds: Number(exercise.rest_seconds) || 0,
        order_index: Number(exercise.order_index) || 0,
        target_rpe: exercise.target_rpe == null ? null : Number(exercise.target_rpe),
        trainer_notes: exercise.trainer_notes ?? null,
      })),
    })),
  };
}

const emptyDraft = (): RoutineDraft => ({
  name: "Rutina manual",
  goal: "fuerza",
  days: [{ day_number: 1, name: "Día 1", focus_area: "Cuerpo completo", exercises: [] }],
});

export function RoutineStudio({ onSaved, routineId }: { onSaved?: () => void; routineId?: string }) {
  const queryClient = useQueryClient();
  const [memberId, setMemberId] = useState("");
  const [goal, setGoal] = useState("hipertrofia");
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [experience, setExperience] = useState("beginner");
  const [sessionMinutes, setSessionMinutes] = useState(60);
  const [injuries, setInjuries] = useState("");
  const [draft, setDraft] = useState<RoutineDraft>(emptyDraft);
  const [generatedByAi, setGeneratedByAi] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [loaded, setLoaded] = useState(!routineId);
  const catalog = useQuery({
    queryKey: ["studio"],
    queryFn: async () => {
      const supabase = createClient();
      const [members, exercises] = await Promise.all([
        supabase.from("profiles").select("id, full_name").eq("role", "member").order("full_name"),
        supabase.from("exercises_library").select("id, name, muscle_group, difficulty").order("name"),
      ]);
      return { members: members.data ?? [], exercises: exercises.data ?? [] };
    },
  });
  const exercises = catalog.data?.exercises ?? [];
  useEffect(() => {
    if (!routineId) return;
    let active = true;
    void (async () => {
      const supabase = createClient();
      const routine = await supabase.from("routines").select("name, goal, member_id, generated_by_ai").eq("id", routineId).maybeSingle();
      if (!active) return;
      if (!routine.data) {
        setLoaded(true);
        setMessage("No se encontró la rutina.");
        return;
      }
      const days = await supabase.from("routine_days").select("id, day_number, name, focus_area").eq("routine_id", routineId).order("day_number");
      const dayIds = (days.data ?? []).map((day) => day.id);
      const exercisesForDays = dayIds.length
        ? await supabase.from("routine_exercises").select("routine_day_id, exercise_id, order_index, sets, reps, rest_seconds, target_rpe, trainer_notes").in("routine_day_id", dayIds).order("order_index")
        : { data: [] };
      if (!active) return;
      setMemberId(routine.data.member_id);
      setGoal(routine.data.goal);
      setGeneratedByAi(routine.data.generated_by_ai);
      setLoaded(true);
      setDraft({
        name: routine.data.name,
        goal: routine.data.goal,
        days: (days.data ?? []).map((day) => ({
          day_number: day.day_number,
          name: day.name,
          focus_area: day.focus_area ?? "General",
          exercises: (exercisesForDays.data ?? []).filter((exercise) => exercise.routine_day_id === day.id).map((exercise) => ({
            exercise_id: exercise.exercise_id,
            order_index: exercise.order_index,
            sets: exercise.sets,
            reps: exercise.reps,
            rest_seconds: exercise.rest_seconds,
            target_rpe: exercise.target_rpe,
            trainer_notes: exercise.trainer_notes,
          })),
        })),
      });
    })();
    return () => {
      active = false;
    };
  }, [routineId]);
  useEffect(() => {
    if (!memberId) return;
    void createClient().from("profiles").select("medical_notes").eq("id", memberId).maybeSingle().then(({ data }) => {
      setInjuries(data?.medical_notes ?? "");
    });
  }, [memberId]);

  function updateDay(index: number, patch: Partial<RoutineDraft["days"][number]>) {
    setDraft((current) => ({
      ...current,
      days: current.days.map((day, dayIndex) => (dayIndex === index ? { ...day, ...patch } : day)),
    }));
  }

  function updateExercise(
    dayIndex: number,
    exerciseIndex: number,
    patch: Partial<RoutineDraft["days"][number]["exercises"][number]>,
  ) {
    setDraft((current) => ({
      ...current,
      days: current.days.map((day, index) =>
        index === dayIndex
          ? { ...day, exercises: day.exercises.map((exercise, position) => (position === exerciseIndex ? { ...exercise, ...patch } : exercise)) }
          : day,
      ),
    }));
  }

  async function generate() {
    setPending(true);
    setMessage("");
    const { data, error } = await createClient().functions.invoke("generate-ai-routine", {
      body: { memberId, goal, daysPerWeek, experience, sessionMinutes, injuries },
    });
    setPending(false);
    if (error || !data?.draft) {
      const fallback = catalogRoutine(exercises, { goal, daysPerWeek, experience, sessionMinutes, injuries });
      if (!fallback) {
        setGeneratedByAi(false);
        setMessage(await geminiFailure(error));
        return;
      }
      setDraft(asDraft(fallback));
      setGeneratedByAi(false);
      setMessage("Gemini está saturado. Armé la rutina con el catálogo para que la revises antes de guardarla.");
      return;
    }
    setDraft(asDraft(data.draft as RoutineDraft));
    setGeneratedByAi(data.source !== "catalog");
    setMessage(data.source === "catalog"
      ? "Gemini está saturado. Armé la rutina con el catálogo para que la revises antes de guardarla."
      : "Borrador listo. Revísalo antes de guardarlo.");
  }

  async function persist() {
    if (!memberId) {
      setMessage("Elige un cliente.");
      return;
    }
    const formData = new FormData();
    formData.set("payload", JSON.stringify({
      ...asDraft(draft),
      goal,
      memberId,
      routineId,
      generatedByAi,
      aiPromptContext: generatedByAi ? { goal, daysPerWeek, experience, sessionMinutes, injuries } : null,
    }));
    const result = await saveRoutine({}, formData);
    setMessage(result.error ?? result.ok ?? "");
    if (result.ok) {
      await queryClient.invalidateQueries({ queryKey: ["routines"] });
      onSaved?.();
    }
  }

  if (routineId && !loaded) return <p className="text-sm text-muted-foreground">Cargando rutina…</p>;
  return (
    <div className="flex flex-col gap-6">
      <Card className="grid gap-3 md:grid-cols-3">
        <Field label="Cliente">
          <Select value={memberId} onChange={(event) => setMemberId(event.target.value)}>
            <option value="">Seleccionar</option>
            {(catalog.data?.members ?? []).map((member) => (
              <option key={member.id} value={member.id}>{member.full_name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Objetivo">
          <Select value={goal} onChange={(event) => { setGoal(event.target.value); setDraft((current) => ({ ...current, goal: event.target.value })); }}>
            <option value="hipertrofia">Hipertrofia</option>
            <option value="perdida_de_grasa">Pérdida de grasa</option>
            <option value="fuerza">Fuerza</option>
            <option value="resistencia">Resistencia</option>
          </Select>
        </Field>
        <Field label="Días por semana">
          <Input type="number" min={1} max={7} value={daysPerWeek} onChange={(event) => setDaysPerWeek(Number(event.target.value))} />
        </Field>
        <Field label="Experiencia">
          <Select value={experience} onChange={(event) => setExperience(event.target.value)}>
            <option value="beginner">Principiante</option>
            <option value="intermediate">Intermedio</option>
            <option value="advanced">Avanzado</option>
          </Select>
        </Field>
        <Field label="Minutos">
          <Input type="number" min={20} max={180} value={sessionMinutes} onChange={(event) => setSessionMinutes(Number(event.target.value))} />
        </Field>
        <Field label="Lesiones">
          <TextArea value={injuries} onChange={(event) => setInjuries(event.target.value)} />
        </Field>
        <Button disabled={pending || !memberId} onClick={() => void generate()} type="button">Generar con Gemini</Button>
      </Card>
      {message ? <p className="text-sm">{message}</p> : null}
      <Field label="Nombre de la rutina">
        <Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
      </Field>
      {draft.days.map((day, dayIndex) => (
        <Card key={day.day_number}>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Día"><Input value={day.name} onChange={(event) => updateDay(dayIndex, { name: event.target.value })} /></Field>
            <Field label="Enfoque"><Input value={day.focus_area} onChange={(event) => updateDay(dayIndex, { focus_area: event.target.value })} /></Field>
          </div>
          <div className="mt-4 space-y-3">
            {day.exercises.map((exercise, exerciseIndex) => (
              <div key={`${day.day_number}-${exerciseIndex}`} className="grid gap-2 md:grid-cols-4">
                <Select value={exercise.exercise_id} onChange={(event) => updateExercise(dayIndex, exerciseIndex, { exercise_id: event.target.value })}>
                  {exercises.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </Select>
                <Input type="number" value={exercise.sets} onChange={(event) => updateExercise(dayIndex, exerciseIndex, { sets: Number(event.target.value) })} />
                <Input value={exercise.reps} onChange={(event) => updateExercise(dayIndex, exerciseIndex, { reps: event.target.value })} />
                <Input type="number" value={exercise.rest_seconds} onChange={(event) => updateExercise(dayIndex, exerciseIndex, { rest_seconds: Number(event.target.value) })} />
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() => updateDay(dayIndex, {
                exercises: [...day.exercises, {
                  exercise_id: exercises[0]?.id ?? "",
                  order_index: day.exercises.length,
                  sets: 3,
                  reps: "8-12",
                  rest_seconds: 90,
                  target_rpe: 7,
                  trainer_notes: null,
                }],
              })}
            >
              Agregar ejercicio
            </Button>
          </div>
        </Card>
      ))}
      <Button onClick={() => void persist()} type="button">{routineId ? "Guardar cambios" : "Guardar rutina"}</Button>
    </div>
  );
}
