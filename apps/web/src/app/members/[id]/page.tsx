"use client";

import { useActionState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { saveMeasurement, shareMemberAccess, subscribeMember, updateMedicalNotes, updateMember, type ActionState } from "@/app/actions";
import { FormNote } from "@/components/form-note";
import { ShareAccess } from "@/components/share-access";
import { Button, Card, Field, Input, Select, TextArea } from "@/components/ui";
import { day, money } from "@/lib/format";
import { createClient } from "@/lib/supabase/browser";

export default function MemberDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [editState, editAction, editPending] = useActionState<ActionState, FormData>(updateMember, {});
  const [shareState, shareAction, sharePending] = useActionState<ActionState, FormData>(shareMemberAccess, {});
  const [notesState, notesAction] = useActionState<ActionState, FormData>(updateMedicalNotes, {});
  const [payState, payAction] = useActionState<ActionState, FormData>(subscribeMember, {});
  const [measureState, measureAction] = useActionState<ActionState, FormData>(saveMeasurement, {});
  const detail = useQuery({
    queryKey: ["member", id],
    queryFn: async () => {
      const supabase = createClient();
      const [profile, plans, subs, payments, measures] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", id).single(),
        supabase.from("membership_plans").select("id, name, price").eq("is_active", true),
        supabase.from("member_subscriptions").select("id, status, start_date, end_date, remaining_credits").eq("member_id", id),
        supabase.from("payments").select("id, final_amount, discount_amount, payment_method").eq("member_id", id),
        supabase.from("body_measurements").select("id, recorded_at, weight_kg, body_fat_pct").eq("member_id", id).order("recorded_at", { ascending: false }),
      ]);
      if (profile.error) throw profile.error;
      return { profile: profile.data, plans: plans.data ?? [], subs: subs.data ?? [], payments: payments.data ?? [], measures: measures.data ?? [] };
    },
  });
  const profile = detail.data?.profile;
  if (!profile) return <p>Cargando ficha…</p>;
  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-6">
      <div>
        <h1 className="text-4xl font-semibold">{profile.full_name}</h1>
        <p className="text-muted-foreground">{profile.email}{profile.phone ? ` · ${profile.phone}` : ""}{profile.national_id ? ` · cédula ${profile.national_id}` : ""}</p>
        <p className="mt-2 font-mono text-xs">QR {profile.qr_code_token}</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-semibold">Datos del cliente</h2>
          <form key={profile.updated_at} action={editAction} className="mt-3 grid gap-3 sm:grid-cols-2">
            <input name="memberId" type="hidden" value={profile.id} />
            <Field label="Nombre *"><Input name="fullName" defaultValue={profile.full_name} required /></Field>
            <Field label="Cédula"><Input name="nationalId" defaultValue={profile.national_id ?? ""} /></Field>
            <Field label="Fecha de nacimiento"><Input name="birthDate" type="date" defaultValue={profile.birth_date ?? ""} /></Field>
            <Field label="Género">
              <Select name="gender" defaultValue={profile.gender ?? ""}>
                <option value="">Seleccionar</option>
                <option value="Femenino">Femenino</option>
                <option value="Masculino">Masculino</option>
                <option value="Otro">Otro</option>
              </Select>
            </Field>
            <Field label="Correo *"><Input name="email" type="email" defaultValue={profile.email} required /></Field>
            <Field label="Teléfono *"><Input name="phone" type="tel" defaultValue={profile.phone ?? ""} required /></Field>
            <div className="sm:col-span-2">
              <FormNote state={editState} />
              <Button className="mt-3" disabled={editPending} type="submit">{editPending ? "Guardando…" : "Guardar cambios"}</Button>
            </div>
          </form>
        </Card>
        <Card>
          <h2 className="font-semibold">Compartir acceso a la app</h2>
          <p className="mt-1 text-sm text-muted-foreground">Genera un enlace o un QR. La contraseña anterior deja de funcionar.</p>
          <form action={shareAction} className="mt-3">
            <input name="memberId" type="hidden" value={profile.id} />
            <FormNote state={shareState} />
            <Button className="mt-3" disabled={sharePending} type="submit">{sharePending ? "Preparando…" : "Generar enlace"}</Button>
          </form>
          {shareState.share ? <ShareAccess share={shareState.share} /> : null}
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-semibold">Ficha clínica</h2>
          <form action={notesAction} className="mt-3 flex flex-col gap-3">
            <input name="memberId" type="hidden" value={profile.id} />
            <Field label="Estado">
              <Select name="status" defaultValue={profile.status}>
                <option value="active">Activo</option>
                <option value="suspended">Suspendido</option>
                <option value="inactive">Inactivo</option>
              </Select>
            </Field>
            <Field label="Lesiones y notas"><TextArea name="medicalNotes" defaultValue={profile.medical_notes ?? ""} /></Field>
            <FormNote state={notesState} />
            <Button type="submit">Guardar ficha</Button>
          </form>
        </Card>
        <Card>
          <h2 className="font-semibold">Activar membresía</h2>
          <form action={payAction} className="mt-3 flex flex-col gap-3">
            <input name="memberId" type="hidden" value={profile.id} />
            <Field label="Plan">
              <Select name="planId" required>
                {detail.data?.plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>{plan.name} · {money(plan.price)}</option>
                ))}
              </Select>
            </Field>
            <Field label="Método">
              <Select name="paymentMethod" defaultValue="cash">
                <option value="cash">Efectivo</option>
                <option value="card">Tarjeta</option>
                <option value="transfer">Transferencia</option>
              </Select>
            </Field>
            <Field label="Referencia"><Input name="referenceNumber" /></Field>
            <Field label="Código promocional"><Input name="promotionCode" placeholder="BIENVENIDA20" /></Field>
            <FormNote state={payState} />
            <Button type="submit">Cobrar y activar</Button>
          </form>
        </Card>
      </div>
      <Card>
        <h2 className="font-semibold">Suscripciones</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {detail.data?.subs.map((sub) => (
            <li key={sub.id}>{sub.status} · {day(sub.start_date)} a {day(sub.end_date)} · créditos {sub.remaining_credits}</li>
          ))}
        </ul>
        <h2 className="mt-5 font-semibold">Pagos</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {detail.data?.payments.map((payment) => (
            <li key={payment.id}>{money(payment.final_amount)} · descuento {money(payment.discount_amount)} · {payment.payment_method}</li>
          ))}
        </ul>
      </Card>
      <Card>
        <h2 className="font-semibold">Medidas</h2>
        <form action={measureAction} className="mt-3 grid gap-3 sm:grid-cols-4">
          <input name="memberId" type="hidden" value={profile.id} />
          <Field label="Peso kg"><Input name="weightKg" type="number" step="0.1" /></Field>
          <Field label="% grasa"><Input name="bodyFatPct" type="number" step="0.1" /></Field>
          <Field label="Cintura cm"><Input name="waistCm" type="number" step="0.1" /></Field>
          <Field label="Notas"><Input name="notes" /></Field>
          <FormNote state={measureState} />
          <Button type="submit">Registrar</Button>
        </form>
        <ul className="mt-4 space-y-1 text-sm">
          {detail.data?.measures.map((row) => (
            <li key={row.id}>{day(row.recorded_at)} · {row.weight_kg ?? "—"} kg · grasa {row.body_fat_pct ?? "—"}%</li>
          ))}
        </ul>
      </Card>
    </section>
  );
}
