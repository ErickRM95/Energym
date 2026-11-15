"use client";

import { RoutineStudio } from "@/components/routine-studio";

export default function StudioPage() {
  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-6">
      <h1 className="text-4xl font-semibold">Estudio de rutinas</h1>
      <RoutineStudio />
    </section>
  );
}
