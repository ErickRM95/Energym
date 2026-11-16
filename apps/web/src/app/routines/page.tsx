"use client";

import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RoutineStudio } from "@/components/routine-studio";
import { Badge, Button, Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/browser";

export default function RoutinesPage() {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const routines = useQuery({
    queryKey: ["routines"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("routines")
        .select("id, name, goal, generated_by_ai, is_active, member_id")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const memberIds = [...new Set((data ?? []).map((routine) => routine.member_id))];
      const profiles = memberIds.length
        ? await supabase.from("profiles").select("id, full_name").in("id", memberIds)
        : { data: [] };
      const names = new Map((profiles.data ?? []).map((profile) => [profile.id, profile.full_name]));
      return (data ?? []).map((routine) => ({ ...routine, memberName: names.get(routine.member_id) ?? "Cliente" }));
    },
  });
  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-6">
      <div>
        <h1 className="text-4xl font-semibold">Rutinas</h1>
        <Card className="mt-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Agregar nueva rutina</h2>
            <Button type="button" variant="outline" onClick={() => { setEditingId(null); setOpen((value) => !value); }}>
              {open ? "Minimizar" : "Maximizar"}
            </Button>
          </div>
          {open ? <div className="mt-4"><RoutineStudio onSaved={() => setOpen(false)} /></div> : null}
        </Card>
        <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Objetivo</th>
                <th className="px-4 py-3 font-medium">Origen</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {routines.error ? (
                <tr>
                  <td className="px-4 py-3 text-destructive" colSpan={6}>{routines.error.message}</td>
                </tr>
              ) : null}
              {(routines.data ?? []).map((routine) => (
                <Fragment key={routine.id}>
                  <tr className="border-t border-border">
                    <td className="px-4 py-3">{routine.memberName}</td>
                    <td className="px-4 py-3">{routine.name}</td>
                    <td className="px-4 py-3">{routine.goal}</td>
                    <td className="px-4 py-3">{routine.generated_by_ai ? <Badge tone="good">IA</Badge> : <Badge>Manual</Badge>}</td>
                    <td className="px-4 py-3">{routine.is_active ? "Activa" : "Archivada"}</td>
                    <td className="px-4 py-3 text-right">
                      <Button type="button" variant="outline" onClick={() => { setOpen(false); setEditingId((current) => current === routine.id ? null : routine.id); }}>
                        {editingId === routine.id ? "Cerrar" : "Editar"}
                      </Button>
                    </td>
                  </tr>
                  {editingId === routine.id ? (
                    <tr className="border-t border-border bg-muted/40">
                      <td className="px-4 py-4" colSpan={6}>
                        <RoutineStudio routineId={routine.id} onSaved={() => setEditingId(null)} />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
