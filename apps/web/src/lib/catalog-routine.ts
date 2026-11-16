import type { RoutineDraft } from "@energym/shared";

type CatalogExercise = { id: string; name: string; muscle_group: string; difficulty: string };

export function catalogRoutine(
  catalog: CatalogExercise[],
  input: { goal: string; daysPerWeek: number; experience: string; sessionMinutes: number; injuries: string },
): RoutineDraft | null {
  if (catalog.length === 0) return null;
  const dayCount = Math.min(7, Math.max(1, input.daysPerWeek || 3));
  const exerciseCount = Math.min(6, Math.max(4, Math.round((input.sessionMinutes || 60) / 12)));
  const maxRank = input.experience === "advanced" ? 2 : input.experience === "intermediate" ? 1 : 0;
  const notes = input.injuries.toLowerCase();
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
  }[input.goal] ?? { sets: 3, reps: "8-12", rest: 90, rpe: 7 };
  const sets = input.experience === "beginner" ? Math.max(2, prescription.sets - 1) : prescription.sets;
  const goalName = { hipertrofia: "Hipertrofia", perdida_de_grasa: "Pérdida de grasa", fuerza: "Fuerza", resistencia: "Resistencia" }[input.goal] ?? "Fuerza";
  const used = new Set<string>();

  function pick(focus: string[]) {
    const preferred = catalog.filter((exercise) => !used.has(exercise.id) && !blocked(exercise) && rank(exercise) <= maxRank);
    const pool = preferred.length > 0 ? preferred : catalog.filter((exercise) => !used.has(exercise.id) && !blocked(exercise));
    const source = pool.length > 0 ? pool : catalog;
    const picked: CatalogExercise[] = [];
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

  function rank(exercise: CatalogExercise) {
    return exercise.difficulty === "advanced" ? 2 : exercise.difficulty === "intermediate" ? 1 : 0;
  }

  function blocked(exercise: CatalogExercise) {
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

  return {
    name: `Rutina de ${goalName}`,
    goal: input.goal,
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
