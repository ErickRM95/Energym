"use client";

import { Fragment, useActionState, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { savePayment, type ActionState } from "@/app/actions";
import { FormNote } from "@/components/form-note";
import { Button, Card, Field, Input, Select } from "@/components/ui";
import { day, money, when } from "@/lib/format";
import { createClient } from "@/lib/supabase/browser";

const methods = [
  ["cash", "Efectivo"],
  ["card", "Tarjeta"],
  ["sinpe", "SINPE Móvil"],
  ["transfer", "Transferencia"],
] as const;

const methodLabel = Object.fromEntries(methods) as Record<string, string>;

type ClientOption = { id: string; full_name: string };
type SubscriptionOption = { id: string; member_id: string; plan_id: string; status: string; start_date: string; end_date: string };
type PaymentRow = {
  id: string;
  member_id: string;
  subscription_id: string;
  original_amount: number;
  discount_amount: number;
  final_amount: number;
  payment_method: string;
  reference_number: string | null;
  paid_at: string | null;
};

function localInput(value: string | null) {
  const date = value ? new Date(value) : new Date();
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function PaymentFields({
  payment,
  clients,
  subscriptions,
  planNames,
}: {
  payment?: PaymentRow;
  clients: ClientOption[];
  subscriptions: SubscriptionOption[];
  planNames: Map<string, string>;
}) {
  const [memberId, setMemberId] = useState(payment?.member_id ?? "");
  const options = subscriptions.filter((subscription) => subscription.member_id === memberId);
  const subscriptionId = options.some((subscription) => subscription.id === payment?.subscription_id) ? payment?.subscription_id : options[0]?.id;
  return (
    <>
      {payment ? <input name="paymentId" type="hidden" value={payment.id} /> : null}
      <Field label="Cliente *">
        <Select name="memberId" required value={memberId} onChange={(event) => setMemberId(event.target.value)}>
          <option value="" disabled>Seleccionar</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>{client.full_name}</option>
          ))}
        </Select>
      </Field>
      <Field label="Suscripción *">
        <Select key={memberId} name="subscriptionId" required defaultValue={subscriptionId ?? ""}>
          <option value="" disabled>Seleccionar</option>
          {options.map((subscription) => (
            <option key={subscription.id} value={subscription.id}>
              {planNames.get(subscription.plan_id) ?? "Plan"} · {subscription.status} · {day(subscription.start_date)} a {day(subscription.end_date)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Monto *"><Input name="originalAmount" type="number" min="0" step="0.01" defaultValue={payment?.original_amount} required /></Field>
      <Field label="Descuento"><Input name="discountAmount" type="number" min="0" step="0.01" defaultValue={payment?.discount_amount ?? 0} /></Field>
      <Field label="Método *">
        <Select name="paymentMethod" required defaultValue={payment?.payment_method ?? ""}>
          <option value="" disabled>Seleccionar</option>
          {methods.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </Select>
      </Field>
      <Field label="Referencia"><Input name="referenceNumber" defaultValue={payment?.reference_number ?? ""} /></Field>
      <Field label="Fecha *"><Input name="paidAt" type="datetime-local" defaultValue={localInput(payment?.paid_at ?? null)} required /></Field>
    </>
  );
}

export default function PaymentsPage() {
  const [state, action, pending] = useActionState<ActionState, FormData>(savePayment, {});
  const [editState, editAction, editPending] = useActionState<ActionState, FormData>(savePayment, {});
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  useEffect(() => {
    if (state.ok) setOpen(false);
    else if (state.error) setOpen(true);
  }, [state]);
  useEffect(() => {
    if (editState.ok) setEditingId(null);
  }, [editState]);
  const payments = useQuery({
    queryKey: ["payments"],
    queryFn: async () => {
      const { data, error } = await createClient()
        .from("payments")
        .select("id, member_id, subscription_id, final_amount, discount_amount, original_amount, payment_method, reference_number, paid_at")
        .order("paid_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const clients = useQuery({
    queryKey: ["payment-clients"],
    queryFn: async () => {
      const { data, error } = await createClient().from("profiles").select("id, full_name").eq("role", "member").order("full_name");
      if (error) throw error;
      return data;
    },
  });
  const subscriptions = useQuery({
    queryKey: ["payment-subscriptions"],
    queryFn: async () => {
      const { data, error } = await createClient()
        .from("member_subscriptions")
        .select("id, member_id, plan_id, status, start_date, end_date")
        .order("end_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const plans = useQuery({
    queryKey: ["payment-plans"],
    queryFn: async () => {
      const { data, error } = await createClient().from("membership_plans").select("id, name");
      if (error) throw error;
      return data;
    },
  });
  const names = new Map((clients.data ?? []).map((client) => [client.id, client.full_name]));
  const planNames = new Map((plans.data ?? []).map((plan) => [plan.id, plan.name]));
  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-6">
      <div>
        <div className="flex items-end justify-between gap-3">
          <h1 className="text-4xl font-semibold">Pagos</h1>
          <a className="text-sm underline" href="/payments/export">Exportar CSV</a>
        </div>
        <Card className="mt-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Agregar nuevo pago</h2>
            <Button type="button" variant="outline" onClick={() => setOpen((value) => !value)}>
              {open ? "Minimizar" : "Maximizar"}
            </Button>
          </div>
          {!open && (state.ok || state.error) ? <div className="mt-3"><FormNote state={state} /></div> : null}
          {open ? (
            <form action={action} className="mt-4 grid gap-3 sm:grid-cols-2">
              <PaymentFields clients={clients.data ?? []} subscriptions={subscriptions.data ?? []} planNames={planNames} />
              <div className="sm:col-span-2">
                <FormNote state={state} />
                <Button className="mt-3" disabled={pending} type="submit">{pending ? "Guardando…" : "Registrar pago"}</Button>
              </div>
            </form>
          ) : null}
        </Card>
        <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Original</th>
                <th className="px-4 py-3 font-medium">Descuento</th>
                <th className="px-4 py-3 font-medium">Cobrado</th>
                <th className="px-4 py-3 font-medium">Método</th>
                <th className="px-4 py-3"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {payments.error ? (
                <tr>
                  <td className="px-4 py-3 text-destructive" colSpan={7}>{payments.error.message}</td>
                </tr>
              ) : null}
              {(payments.data ?? []).map((payment) => (
                <Fragment key={payment.id}>
                  <tr className="border-t border-border">
                    <td className="px-4 py-3">{when(payment.paid_at)}</td>
                    <td className="px-4 py-3">{names.get(payment.member_id) ?? "Cliente"}</td>
                    <td className="px-4 py-3">{money(payment.original_amount)}</td>
                    <td className="px-4 py-3">{money(payment.discount_amount)}</td>
                    <td className="px-4 py-3 font-mono">{money(payment.final_amount)}</td>
                    <td className="px-4 py-3">{methodLabel[payment.payment_method] ?? payment.payment_method}</td>
                    <td className="px-4 py-3 text-right">
                      <Button type="button" variant="outline" onClick={() => setEditingId((current) => current === payment.id ? null : payment.id)}>
                        {editingId === payment.id ? "Cerrar" : "Editar"}
                      </Button>
                    </td>
                  </tr>
                  {editingId === payment.id ? (
                    <tr className="border-t border-border bg-muted/50">
                      <td className="px-4 py-4" colSpan={7}>
                        <form key={payment.id} action={editAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          <PaymentFields payment={payment} clients={clients.data ?? []} subscriptions={subscriptions.data ?? []} planNames={planNames} />
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
