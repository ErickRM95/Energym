"use client";

import { useActionState, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { markAttendance, saveClass, type ActionState } from "@/app/actions";
import { FormNote } from "@/components/form-note";
import { Button, Card, Field, Input, Select } from "@/components/ui";
import { when } from "@/lib/format";
import { createClient } from "@/lib/supabase/browser";

function localInput(value: string) {
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function ClassesPage() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [state, action, pending] = useActionState<ActionState, FormData>(saveClass, {});
  const [editState, editAction, editPending] = useActionState<ActionState, FormData>(saveClass, {});
  const data = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const supabase = createClient();
      const [types, trainers, schedules, bookings] = await Promise.all([
        supabase.from("class_types").select("id, name, color_hex"),
        supabase.from("profiles").select("id, full_name").in("role", ["trainer", "gym_admin"]),
        supabase.from("class_schedules").select("*").order("start_time"),
        supabase.from("class_bookings").select("id, class_schedule_id, status").eq("status", "confirmed"),
      ]);
      return { types: types.data ?? [], trainers: trainers.data ?? [], schedules: schedules.data ?? [], bookings: bookings.data ?? [] };
    },
  });
  useEffect(() => {
    if (!state.ok && !editState.ok) return;
    if (editState.ok) setEditingId(null);
    void queryClient.invalidateQueries({ queryKey: ["classes"] });
  }, [editState.ok, queryClient, state.ok]);
  return (
    <section className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_320px]">
      <div>
        <h1 className="text-4xl font-semibold">Clases</h1>
        <div className="mt-4 grid gap-3">
          {(data.data?.schedules ?? []).map((schedule) => {
            const type = data.data?.types.find((item) => item.id === schedule.class_type_id);
            const seats = (data.data?.bookings ?? []).filter((booking) => booking.class_schedule_id === schedule.id);
            const editing = editingId === schedule.id;
            return (
              <Card key={schedule.id}>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-semibold">{type?.name ?? "Clase"}</h2>
                  <p className="font-mono text-sm">{seats.length}/{schedule.max_capacity}</p>
                </div>
                <p className="text-sm text-muted-foreground">{when(schedule.start_time)}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {seats.map((booking) => (
                    <form key={booking.id} action={async (formData) => { await markAttendance(formData); }}>
                      <input name="bookingId" type="hidden" value={booking.id} />
                      <input name="status" type="hidden" value="attended" />
                      <Button type="submit" variant="outline">Asistió</Button>
                    </form>
                  ))}
                  <Button type="button" variant="outline" onClick={() => setEditingId(editing ? null : schedule.id)}>
                    {editing ? "Cerrar" : "Editar"}
                  </Button>
                </div>
                {editing ? (
                  <form key={schedule.id} action={editAction} className="mt-4 grid gap-3 sm:grid-cols-2">
                    <input name="scheduleId" type="hidden" value={schedule.id} />
                    <Field label="Tipo">
                      <Select name="classTypeId" defaultValue={schedule.class_type_id} required>
                        {(data.data?.types ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                      </Select>
                    </Field>
                    <Field label="Instructor">
                      <Select name="trainerId" defaultValue={schedule.trainer_id ?? ""}>
                        <option value="">Sin asignar</option>
                        {(data.data?.trainers ?? []).map((trainer) => <option key={trainer.id} value={trainer.id}>{trainer.full_name}</option>)}
                      </Select>
                    </Field>
                    <Field label="Inicio"><Input name="startTime" type="datetime-local" defaultValue={localInput(schedule.start_time)} required /></Field>
                    <Field label="Fin"><Input name="endTime" type="datetime-local" defaultValue={localInput(schedule.end_time)} required /></Field>
                    <Field label="Cupo"><Input name="maxCapacity" type="number" min="1" defaultValue={schedule.max_capacity} required /></Field>
                    <div className="sm:col-span-2">
                      <FormNote state={editState} />
                      <Button className="mt-3" disabled={editPending} type="submit">{editPending ? "Guardando…" : "Guardar cambios"}</Button>
                    </div>
                  </form>
                ) : null}
              </Card>
            );
          })}
        </div>
      </div>
      <Card>
        <h2 className="font-semibold">Programar</h2>
        <form action={action} className="mt-4 flex flex-col gap-3">
          <Field label="Tipo">
            <Select name="classTypeId" required>
              {(data.data?.types ?? []).map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
            </Select>
          </Field>
          <Field label="Instructor">
            <Select name="trainerId">
              <option value="">Sin asignar</option>
              {(data.data?.trainers ?? []).map((trainer) => <option key={trainer.id} value={trainer.id}>{trainer.full_name}</option>)}
            </Select>
          </Field>
          <Field label="Inicio"><Input name="startTime" type="datetime-local" required /></Field>
          <Field label="Fin"><Input name="endTime" type="datetime-local" required /></Field>
          <Field label="Cupo"><Input name="maxCapacity" type="number" min="1" required /></Field>
          <Field label="Semanas"><Input name="occurrences" type="number" min="1" max="12" defaultValue={1} /></Field>
          <FormNote state={state} />
          <Button disabled={pending} type="submit">Crear horario</Button>
        </form>
      </Card>
    </section>
  );
}
