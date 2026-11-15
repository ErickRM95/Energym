"use client";

import { Fragment, useActionState, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { savePlan, type ActionState } from "@/app/actions";
import { FormNote } from "@/components/form-note";
import { Badge, Button, Card, Field, Input } from "@/components/ui";
import { money } from "@/lib/format";
import { createClient } from "@/lib/supabase/browser";

export default function PlansPage() {
  const [state, action, pending] = useActionState<ActionState, FormData>(savePlan, {});
  const [editState, editAction, editPending] = useActionState<ActionState, FormData>(savePlan, {});
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  useEffect(() => {
    if (state.ok) setOpen(false);
    else if (state.error) setOpen(true);
  }, [state]);
  useEffect(() => {
    if (editState.ok) setEditingId(null);
  }, [editState]);
  const plans = useQuery({
    queryKey: ["plans-admin"],
    queryFn: async () => {
      const { data, error } = await createClient().from("membership_plans").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-6">
      <div>
        <h1 className="text-4xl font-semibold">Planes</h1>
        <Card className="mt-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Agregar nuevo plan</h2>
            <Button type="button" variant="outline" onClick={() => setOpen((value) => !value)}>
              {open ? "Minimizar" : "Maximizar"}
            </Button>
          </div>
          {!open && (state.ok || state.error) ? <div className="mt-3"><FormNote state={state} /></div> : null}
          {open ? (
            <form action={action} className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Nombre *"><Input name="name" required /></Field>
              <Field label="Descripción"><Input name="description" /></Field>
              <Field label="Precio *"><Input name="price" type="number" min="0" step="0.01" required /></Field>
              <Field label="Días *"><Input name="durationDays" type="number" min="1" required /></Field>
              <Field label="Créditos (0 = ilimitado)"><Input name="classCredits" type="number" min="0" defaultValue={0} /></Field>
              <label className="flex items-center gap-2 text-sm"><input name="isActive" type="checkbox" defaultChecked /> Activo</label>
              <div className="sm:col-span-2">
                <FormNote state={state} />
                <Button className="mt-3" disabled={pending} type="submit">{pending ? "Guardando…" : "Guardar plan"}</Button>
              </div>
            </form>
          ) : null}
        </Card>
        <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Precio</th>
                <th className="px-4 py-3 font-medium">Duración</th>
                <th className="px-4 py-3 font-medium">Créditos</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {plans.error ? (
                <tr>
                  <td className="px-4 py-3 text-destructive" colSpan={6}>{plans.error.message}</td>
                </tr>
              ) : null}
              {(plans.data ?? []).map((plan) => (
                <Fragment key={plan.id}>
                  <tr className="border-t border-border">
                    <td className="px-4 py-3">{plan.name}</td>
                    <td className="px-4 py-3 font-mono">{money(plan.price)}</td>
                    <td className="px-4 py-3">{plan.duration_days} días</td>
                    <td className="px-4 py-3">{plan.class_credits === 0 ? "Ilimitado" : plan.class_credits}</td>
                    <td className="px-4 py-3">
                      <Badge tone={plan.is_active ? "good" : "bad"}>{plan.is_active ? "Activo" : "Inactivo"}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button type="button" variant="outline" onClick={() => setEditingId((current) => current === plan.id ? null : plan.id)}>
                        {editingId === plan.id ? "Cerrar" : "Editar"}
                      </Button>
                    </td>
                  </tr>
                  {editingId === plan.id ? (
                    <tr className="border-t border-border bg-muted/50">
                      <td className="px-4 py-4" colSpan={6}>
                        <form key={plan.id} action={editAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          <input name="planId" type="hidden" value={plan.id} />
                          <Field label="Nombre *"><Input name="name" defaultValue={plan.name} required /></Field>
                          <Field label="Descripción"><Input name="description" defaultValue={plan.description ?? ""} /></Field>
                          <Field label="Precio *"><Input name="price" type="number" min="0" step="0.01" defaultValue={plan.price} required /></Field>
                          <Field label="Días *"><Input name="durationDays" type="number" min="1" defaultValue={plan.duration_days} required /></Field>
                          <Field label="Créditos (0 = ilimitado)"><Input name="classCredits" type="number" min="0" defaultValue={plan.class_credits} /></Field>
                          <label className="flex items-center gap-2 text-sm">
                            <input name="isActive" type="checkbox" defaultChecked={plan.is_active} /> Activo
                          </label>
                          <div className="sm:col-span-2 lg:col-span-3">
                            <FormNote state={editState} />
                            <Button className="mt-3" disabled={editPending} type="submit">{editPending ? "Guardando…" : "Guardar cambios"}</Button>
                          </div>
                        </form>
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
