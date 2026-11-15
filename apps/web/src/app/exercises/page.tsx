"use client";

import { useActionState } from "react";
import { useQuery } from "@tanstack/react-query";
import { saveExercise, type ActionState } from "@/app/actions";
import { FormNote } from "@/components/form-note";
import { Button, Card, Field, Input, Select, TextArea } from "@/components/ui";
import { createClient } from "@/lib/supabase/browser";

export default function ExercisesPage() {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveExercise, {});
  const exercises = useQuery({
    queryKey: ["exercises"],
    queryFn: async () => {
      const { data, error } = await createClient().from("exercises_library").select("*").order("muscle_group");
      if (error) throw error;
      return data;
    },
  });
  return (
    <section className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_320px]">
      <div>
        <h1 className="text-4xl font-semibold">Biblioteca</h1>
        <div className="mt-4 grid gap-3">
          {(exercises.data ?? []).map((exercise) => (
            <Card key={exercise.id}>
              <h2 className="font-semibold">{exercise.name}</h2>
              <p className="text-sm text-muted-foreground">
                {exercise.muscle_group} · {exercise.equipment ?? "sin equipo"} · {exercise.difficulty}
              </p>
            </Card>
          ))}
        </div>
      </div>
      <Card>
        <h2 className="font-semibold">Ejercicio de la sede</h2>
        <form action={action} className="mt-4 flex flex-col gap-3">
          <Field label="Nombre"><Input name="name" required /></Field>
          <Field label="Grupo muscular"><Input name="muscleGroup" required /></Field>
          <Field label="Equipo"><Input name="equipment" /></Field>
          <Field label="Dificultad">
            <Select name="difficulty" defaultValue="beginner">
              <option value="beginner">Principiante</option>
              <option value="intermediate">Intermedio</option>
              <option value="advanced">Avanzado</option>
            </Select>
          </Field>
          <Field label="Instrucciones"><TextArea name="instructions" /></Field>
          <Field label="Video"><Input name="videoUrl" /></Field>
          <FormNote state={state} />
          <Button disabled={pending} type="submit">Agregar</Button>
        </form>
      </Card>
    </section>
  );
}
