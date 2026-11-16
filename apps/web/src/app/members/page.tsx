"use client";

import Link from "next/link";
import { Fragment, useActionState, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { attachProvisionedMembers, createMember, deleteMember, shareMemberAccess, updateMember, type ActionState, type AppAccessShare } from "@/app/actions";
import { FormNote } from "@/components/form-note";
import { accessLink, ShareAccess } from "@/components/share-access";
import { Badge, Button, Card, Field, Input, Select, TextArea } from "@/components/ui";
import { useProfile } from "@/components/use-profile";
import { readFitnessNotes } from "@/lib/fitness-notes";
import { createClient } from "@/lib/supabase/browser";

export default function MembersPage() {
  const [state, action, pending] = useActionState<ActionState, FormData>(createMember, {});
  const [editState, editAction, editPending] = useActionState<ActionState, FormData>(updateMember, {});
  const [deleteState, deleteAction, deletePending] = useActionState<ActionState, FormData>(deleteMember, {});
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [shareNote, setShareNote] = useState("");
  const [copying, setCopying] = useState(false);
  const [readyShare, setReadyShare] = useState<AppAccessShare | null>(null);
  async function copyAppLink(memberId: string) {
    if (readyShare) {
      try {
        await navigator.clipboard.writeText(accessLink(window.location.origin, readyShare));
        setShareNote("Enlace copiado. La contraseña anterior ya no sirve.");
      } catch {
        setShareNote("No se pudo copiar. Usa el botón Copiar enlace.");
      }
      return;
    }
    setCopying(true);
    setShareNote("");
    const pending = (async () => {
      const formData = new FormData();
      formData.set("memberId", memberId);
      const result = await shareMemberAccess({}, formData);
      if (!result.share) throw new Error(result.error ?? "No se pudo preparar el enlace.");
      setReadyShare(result.share);
      return new Blob([accessLink(window.location.origin, result.share)], { type: "text/plain" });
    })();
    try {
      await navigator.clipboard.write([new ClipboardItem({ "text/plain": pending })]);
      setShareNote("Enlace copiado. La contraseña anterior ya no sirve.");
    } catch {
      try {
        await pending;
        setShareNote("Enlace listo. Pulsa Copiar enlace. La contraseña anterior ya no sirve.");
      } catch (prepareError) {
        setShareNote(prepareError instanceof Error ? prepareError.message : "No se pudo preparar el enlace.");
      }
    }
    setCopying(false);
  }
  const queryClient = useQueryClient();
  const me = useProfile();
  const canDelete = me.data?.role === "gym_admin" || me.data?.role === "super_admin";
  useEffect(() => {
    if (state.share) setOpen(false);
    else if (state.error) setOpen(true);
    if (state.ok || state.share) void queryClient.invalidateQueries({ queryKey: ["members"] });
  }, [queryClient, state]);
  const [listNote, setListNote] = useState("");
  useEffect(() => {
    if (sessionStorage.getItem("energym-members-attached") === "1") return;
    sessionStorage.setItem("energym-members-attached", "1");
    void attachProvisionedMembers()
      .then(() => queryClient.invalidateQueries({ queryKey: ["members"] }))
      .catch((error: unknown) => {
        sessionStorage.removeItem("energym-members-attached");
        setListNote(error instanceof Error ? error.message : "No se pudo actualizar la lista.");
      });
  }, [queryClient]);
  useEffect(() => {
    if (editState.ok) setEditingId(null);
  }, [editState]);
  useEffect(() => {
    if (!deleteState.ok) return;
    setEditingId(null);
    void queryClient.invalidateQueries({ queryKey: ["members"] });
  }, [deleteState, queryClient]);
  const members = useQuery({
    queryKey: ["members"],
    queryFn: async () => {
      const supabase = createClient();
      const columns = "id, full_name, email, status, phone, birth_date, gender, national_id, medical_notes, created_at";
      const first = await supabase.from("profiles").select(columns).eq("role", "member").order("created_at", { ascending: false });
      if (first.error?.message.includes("national_id")) {
        const retry = await supabase.from("profiles").select("id, full_name, email, status, phone, birth_date, gender, medical_notes, created_at").eq("role", "member").order("created_at", { ascending: false });
        if (retry.error) throw retry.error;
        return retry.data.map((row) => ({ ...row, national_id: null }));
      }
      if (first.error) throw first.error;
      return first.data;
    },
  });
  const plans = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const { data, error } = await createClient().from("membership_plans").select("id, name, price").eq("is_active", true).order("price");
      if (error) throw error;
      return data;
    },
  });
  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-6">
      <div>
        <h1 className="text-4xl font-semibold">Clientes</h1>
        <Card className="mt-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Agregar nuevo cliente</h2>
            <Button type="button" variant="outline" onClick={() => setOpen((value) => !value)}>
              {open ? "Minimizar" : "Maximizar"}
            </Button>
          </div>
          {state.share ? <ShareAccess share={state.share} /> : null}
          {!open && (state.ok || state.error) ? <div className="mt-3"><FormNote state={state} /></div> : null}
          {open ? <form action={action} className="mt-4 grid gap-6 lg:grid-cols-2">
            <div className="flex flex-col gap-3">
              <h3 className="font-semibold">Información personal</h3>
              <Field label="Nombre *"><Input name="fullName" required /></Field>
              <Field label="Cédula - opcional"><Input name="nationalId" /></Field>
              <Field label="Fecha nacimiento - opcional"><Input name="birthDate" type="date" /></Field>
              <Field label="Género - opcional">
                <Select name="gender" defaultValue="">
                  <option value="">Seleccionar</option>
                  <option value="Femenino">Femenino</option>
                  <option value="Masculino">Masculino</option>
                  <option value="Otro">Otro</option>
                </Select>
              </Field>
              <h3 className="mt-2 font-semibold">Contacto</h3>
              <Field label="Correo *"><Input name="email" type="email" required /></Field>
              <Field label="Teléfono *"><Input name="phone" type="tel" required /></Field>
            </div>
            <div className="flex flex-col gap-3">
              <h3 className="font-semibold">Membresía</h3>
              <Field label="Membresía vence el *"><Input name="membershipEndsOn" type="date" required /></Field>
              <Field label="Tipo de membresía *">
                <Select name="planId" required defaultValue="">
                  <option value="" disabled>Seleccionar</option>
                  {(plans.data ?? []).map((plan) => (
                    <option key={plan.id} value={plan.id}>{plan.name}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Tipo de pago *">
                <Select name="paymentMethod" required defaultValue="">
                  <option value="" disabled>Seleccionar</option>
                  <option value="cash">Efectivo</option>
                  <option value="card">Tarjeta</option>
                  <option value="sinpe">SINPE Móvil</option>
                  <option value="transfer">Transferencia</option>
                </Select>
              </Field>
              <FormNote state={state} />
              <Button disabled={pending} type="submit">{pending ? "Guardando…" : "Crear cliente"}</Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:col-span-2">
              <h3 className="font-semibold sm:col-span-2">Notas para la rutina</h3>
              <p className="text-sm text-muted-foreground sm:col-span-2">La IA usa estos datos para armar la rutina a la medida.</p>
              <Field label="Peso (kg)"><Input name="weightKg" type="number" min="1" step="0.1" /></Field>
              <Field label="Tamaño / estatura (cm)"><Input name="heightCm" type="number" min="1" step="0.1" /></Field>
              <Field label="Lesiones"><TextArea name="injuries" /></Field>
              <Field label="Enfermedades"><TextArea name="illnesses" /></Field>
              <div className="sm:col-span-2"><Field label="Otras notas"><TextArea name="otherNotes" /></Field></div>
            </div>
          </form> : null}
        </Card>
        {deleteState.ok || deleteState.error ? <div className="mt-4"><FormNote state={deleteState} /></div> : null}
        <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Correo</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {listNote ? (
                <tr>
                  <td className="px-4 py-3 text-destructive" colSpan={4}>{listNote}</td>
                </tr>
              ) : null}
              {members.error ? (
                <tr>
                  <td className="px-4 py-3 text-destructive" colSpan={4}>{members.error.message}</td>
                </tr>
              ) : null}
              {(members.data ?? []).map((member) => (
                <Fragment key={member.id}>
                  <tr className="border-t border-border">
                    <td className="px-4 py-3">
                      <Link href={`/members/${member.id}`}>{member.full_name}</Link>
                    </td>
                    <td className="px-4 py-3">{member.email}</td>
                    <td className="px-4 py-3">
                      <Badge tone={member.status === "active" ? "good" : "bad"}>{member.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => { setShareNote(""); setReadyShare(null); setEditingId((current) => current === member.id ? null : member.id); }}>
                          {editingId === member.id ? "Cerrar" : "Editar"}
                        </Button>
                        {canDelete ? (
                          <form action={deleteAction} onSubmit={(event) => { if (!window.confirm("¿Eliminar este cliente? También se borra su acceso a la app.")) event.preventDefault(); }}>
                            <input name="memberId" type="hidden" value={member.id} />
                            <Button variant="danger" disabled={deletePending} type="submit">Eliminar</Button>
                          </form>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                  {editingId === member.id ? (
                    <tr className="border-t border-border bg-muted/50">
                      <td className="px-4 py-4" colSpan={4}>
                        <form key={member.id} action={editAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          <input name="memberId" type="hidden" value={member.id} />
                          <Field label="Nombre *"><Input name="fullName" defaultValue={member.full_name} required /></Field>
                          <Field label="Cédula"><Input name="nationalId" defaultValue={member.national_id ?? ""} /></Field>
                          <Field label="Fecha de nacimiento"><Input name="birthDate" type="date" defaultValue={member.birth_date ?? ""} /></Field>
                          <Field label="Género">
                            <Select name="gender" defaultValue={member.gender ?? ""}>
                              <option value="">Seleccionar</option>
                              <option value="Femenino">Femenino</option>
                              <option value="Masculino">Masculino</option>
                              <option value="Otro">Otro</option>
                            </Select>
                          </Field>
                          <Field label="Correo *"><Input name="email" type="email" defaultValue={member.email} required /></Field>
                          <Field label="Teléfono *"><Input name="phone" type="tel" defaultValue={member.phone ?? ""} required /></Field>
                          <Field label="Peso (kg)"><Input name="weightKg" type="number" min="1" step="0.1" defaultValue={readFitnessNotes("medical_notes" in member ? member.medical_notes : "").weightKg ?? ""} /></Field>
                          <Field label="Tamaño / estatura (cm)"><Input name="heightCm" type="number" min="1" step="0.1" defaultValue={readFitnessNotes("medical_notes" in member ? member.medical_notes : "").heightCm ?? ""} /></Field>
                          <Field label="Lesiones"><TextArea name="injuries" defaultValue={readFitnessNotes("medical_notes" in member ? member.medical_notes : "").injuries ?? ""} /></Field>
                          <Field label="Enfermedades"><TextArea name="illnesses" defaultValue={readFitnessNotes("medical_notes" in member ? member.medical_notes : "").illnesses ?? ""} /></Field>
                          <div className="sm:col-span-2 lg:col-span-3"><Field label="Otras notas"><TextArea name="otherNotes" defaultValue={readFitnessNotes("medical_notes" in member ? member.medical_notes : "").otherNotes ?? ""} /></Field></div>
                          <div className="sm:col-span-2 lg:col-span-3">
                            <FormNote state={editState} />
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button disabled={editPending} type="submit">{editPending ? "Guardando…" : "Guardar cambios"}</Button>
                              <Button type="button" variant="outline" disabled={copying} onClick={() => void copyAppLink(member.id)}>
                                {copying ? "Copiando…" : "Copiar enlace de la app"}
                              </Button>
                            </div>
                            {shareNote ? <p className="mt-2 text-sm">{shareNote}</p> : null}
                            {readyShare ? <ShareAccess share={readyShare} /> : null}
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
