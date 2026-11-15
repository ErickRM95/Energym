"use client";

import { Fragment, useActionState, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { savePromotion, type ActionState } from "@/app/actions";
import { FormNote } from "@/components/form-note";
import { Badge, Button, Card, Field, Input, Select } from "@/components/ui";
import { money } from "@/lib/format";
import { createClient } from "@/lib/supabase/browser";

const discountLabels = {
  percentage: "Porcentaje",
  fixed_amount: "Monto fijo",
  extra_days: "Días extra",
  extra_credits: "Créditos extra",
} as const;

const audienceLabels = {
  all: "Todos",
  new_members: "Nuevos",
  renewals: "Renovaciones",
} as const;

type PromotionRow = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  discount_type: keyof typeof discountLabels;
  discount_value: number;
  target_audience: keyof typeof audienceLabels;
  starts_at: string;
  ends_at: string;
  max_redemptions: number | null;
  max_per_member: number;
  current_redemptions: number;
  show_in_mobile_app: boolean;
  is_active: boolean;
  roi?: { discount: number; collected: number };
};

function localInput(value: string) {
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function discountText(promo: PromotionRow) {
  if (promo.discount_type === "percentage") return `${promo.discount_value}%`;
  if (promo.discount_type === "fixed_amount") return money(promo.discount_value);
  if (promo.discount_type === "extra_days") return `${promo.discount_value} días`;
  return `${promo.discount_value} créditos`;
}

function PromotionFields({ promo }: { promo?: PromotionRow }) {
  return (
    <>
      {promo ? <input name="promotionId" type="hidden" value={promo.id} /> : null}
      <Field label="Código *"><Input name="code" defaultValue={promo?.code} required /></Field>
      <Field label="Título *"><Input name="title" defaultValue={promo?.title} required /></Field>
      <Field label="Descripción"><Input name="description" defaultValue={promo?.description ?? ""} /></Field>
      <Field label="Tipo">
        <Select name="discountType" defaultValue={promo?.discount_type ?? "percentage"}>
          <option value="percentage">Porcentaje</option>
          <option value="fixed_amount">Monto fijo</option>
          <option value="extra_days">Días extra</option>
          <option value="extra_credits">Créditos extra</option>
        </Select>
      </Field>
      <Field label="Valor *"><Input name="discountValue" type="number" step="0.01" defaultValue={promo?.discount_value} required /></Field>
      <Field label="Audiencia">
        <Select name="targetAudience" defaultValue={promo?.target_audience ?? "all"}>
          <option value="all">Todos</option>
          <option value="new_members">Nuevos</option>
          <option value="renewals">Renovaciones</option>
        </Select>
      </Field>
      <Field label="Inicio *"><Input name="startsAt" type="datetime-local" defaultValue={promo ? localInput(promo.starts_at) : undefined} required /></Field>
      <Field label="Fin *"><Input name="endsAt" type="datetime-local" defaultValue={promo ? localInput(promo.ends_at) : undefined} required /></Field>
      <Field label="Usos máximos"><Input name="maxRedemptions" type="number" min="1" defaultValue={promo?.max_redemptions ?? ""} /></Field>
      <Field label="Usos por cliente"><Input name="maxPerMember" type="number" min="1" defaultValue={promo?.max_per_member ?? 1} /></Field>
      <label className="flex items-center gap-2 text-sm">
        <input name="showInMobileApp" type="checkbox" defaultChecked={promo?.show_in_mobile_app ?? false} /> Mostrar en la app
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input name="isActive" type="checkbox" defaultChecked={promo?.is_active ?? true} /> Activa
      </label>
    </>
  );
}

export default function PromotionsPage() {
  const [state, action, pending] = useActionState<ActionState, FormData>(savePromotion, {});
  const [editState, editAction, editPending] = useActionState<ActionState, FormData>(savePromotion, {});
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  useEffect(() => {
    if (state.ok) setOpen(false);
    else if (state.error) setOpen(true);
  }, [state]);
  useEffect(() => {
    if (editState.ok) setEditingId(null);
  }, [editState]);
  const promos = useQuery({
    queryKey: ["promotions"],
    queryFn: async () => {
      const supabase = createClient();
      const [promotions, redemptions] = await Promise.all([
        supabase.from("promotions").select("*").order("created_at", { ascending: false }),
        supabase.from("promotion_redemptions").select("promotion_id, discount_applied, final_amount"),
      ]);
      if (promotions.error) throw promotions.error;
      const roi = new Map<string, { discount: number; collected: number }>();
      for (const row of redemptions.data ?? []) {
        const current = roi.get(row.promotion_id) ?? { discount: 0, collected: 0 };
        current.discount += Number(row.discount_applied);
        current.collected += Number(row.final_amount);
        roi.set(row.promotion_id, current);
      }
      return (promotions.data ?? []).map((promo) => ({ ...promo, roi: roi.get(promo.id) }));
    },
  });
  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-6">
      <div>
        <h1 className="text-4xl font-semibold">Promociones</h1>
        <Card className="mt-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Agregar nueva promoción</h2>
            <Button type="button" variant="outline" onClick={() => setOpen((value) => !value)}>
              {open ? "Minimizar" : "Maximizar"}
            </Button>
          </div>
          {!open && (state.ok || state.error) ? <div className="mt-3"><FormNote state={state} /></div> : null}
          {open ? (
            <form action={action} className="mt-4 grid gap-3 sm:grid-cols-2">
              <PromotionFields />
              <div className="sm:col-span-2">
                <FormNote state={state} />
                <Button className="mt-3" disabled={pending} type="submit">{pending ? "Guardando…" : "Publicar"}</Button>
              </div>
            </form>
          ) : null}
        </Card>
        <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Código</th>
                <th className="px-4 py-3 font-medium">Título</th>
                <th className="px-4 py-3 font-medium">Descuento</th>
                <th className="px-4 py-3 font-medium">Usos</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {promos.error ? (
                <tr>
                  <td className="px-4 py-3 text-destructive" colSpan={6}>{promos.error.message}</td>
                </tr>
              ) : null}
              {(promos.data ?? []).map((promo) => (
                <Fragment key={promo.id}>
                  <tr className="border-t border-border">
                    <td className="px-4 py-3"><Badge>{promo.code}</Badge></td>
                    <td className="px-4 py-3">
                      <p>{promo.title}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        Descuento {money(promo.roi?.discount ?? 0)} · cobrado {money(promo.roi?.collected ?? 0)}
                      </p>
                    </td>
                    <td className="px-4 py-3">{discountLabels[promo.discount_type]} · {discountText(promo)}</td>
                    <td className="px-4 py-3">
                      {promo.current_redemptions}{promo.max_redemptions ? `/${promo.max_redemptions}` : ""} · {audienceLabels[promo.target_audience]}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={promo.is_active ? "good" : "bad"}>{promo.is_active ? "Activa" : "Inactiva"}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button type="button" variant="outline" onClick={() => setEditingId((current) => current === promo.id ? null : promo.id)}>
                        {editingId === promo.id ? "Cerrar" : "Editar"}
                      </Button>
                    </td>
                  </tr>
                  {editingId === promo.id ? (
                    <tr className="border-t border-border bg-muted/50">
                      <td className="px-4 py-4" colSpan={6}>
                        <form key={promo.id} action={editAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          <PromotionFields promo={promo} />
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
