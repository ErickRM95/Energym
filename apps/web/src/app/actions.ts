"use server";

import { redirect } from "next/navigation";
import type { Json } from "@energym/shared";
import {
  classScheduleSchema,
  createMemberSchema,
  updateMemberSchema,
  exerciseSchema,
  loginSchema,
  measurementSchema,
  membershipPlanSchema,
  newsPostSchema,
  paymentSchema,
  promotionSchema,
  saveRoutineSchema,
  signupSchema,
  subscribeSchema,
} from "@energym/shared";
import { fitnessNotesText } from "@/lib/fitness-notes";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type AppAccessShare = { name: string; email: string; password: string; pass: string; code: string };
export type ActionState = { error?: string; ok?: string; detail?: string; share?: AppAccessShare };

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

const inviteAlphabet = "abcdefghjkmnpqrstuvwxyz23456789";

function inviteCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (byte) => inviteAlphabet[byte % inviteAlphabet.length]).join("");
}

async function saveMemberInvite(
  admin: ReturnType<typeof createAdminClient>,
  invite: { organizationId: string; memberId: string; name: string; email: string; password: string },
) {
  const removed = await admin.from("member_invites").delete().eq("member_id", invite.memberId);
  if (removed.error) return { error: removed.error.message };
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const code = inviteCode();
    const inserted = await admin.from("member_invites").insert({
      code,
      organization_id: invite.organizationId,
      member_id: invite.memberId,
      full_name: invite.name,
      email: invite.email,
      access_password: invite.password,
    });
    if (!inserted.error) return { code };
    if (!inserted.error.message.includes("duplicate")) return { error: inserted.error.message };
  }
  return { error: "No se pudo crear el enlace." };
}

function issue(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Revisa los datos.";
}

function measure(raw: string | undefined, label: string) {
  if (!raw) return {};
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return { error: `${label} debe ser mayor que cero.` as const };
  return { value };
}

function newsImage(formData: FormData, organizationId: string): { url?: string | null; error?: string } {
  const imageUrl = text(formData, "imageUrl");
  if (imageUrl) {
    const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
    const prefix = `${base}/storage/v1/object/public/org-assets/${organizationId}/news/`;
    if (!base || !imageUrl.startsWith(prefix) || imageUrl.includes("..")) return { error: "La imagen no es válida." };
    return { url: imageUrl };
  }
  if (formData.get("removeImage") === "on") return { url: null };
  return {};
}

function human(message: string) {
  const map: Record<string, string> = {
    "Promotion code not found": "Ese código no existe o no está vigente.",
    "Promotion is not active": "La promoción no está vigente.",
    "Promotion reached its redemption limit": "La promoción ya no tiene usos disponibles.",
    "Promotion does not apply to this plan": "El código no aplica a este plan.",
    "Member already used this promotion": "Este cliente ya usó la promoción.",
    "Promotion is only for new members": "El código es solo para clientes nuevos.",
    "Promotion is only for renewals": "El código es solo para renovaciones.",
    "No active membership": "El cliente no tiene una membresía activa.",
    "No class credits remaining": "No quedan créditos de clase.",
    "Member is not active": "El cliente no está activo.",
    "Plan is not available": "El plan no está disponible.",
  };
  return map[message] ?? message;
}

async function context() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile) redirect("/login");
  return { supabase, profile };
}

async function staff() {
  const result = await context();
  const organizationId = result.profile.organization_id;
  if (!organizationId || result.profile.role === "member") {
    return { error: "Esta acción es del equipo del gimnasio." as const };
  }
  return { supabase: result.supabase, profile: { ...result.profile, organization_id: organizationId } };
}

export async function login(_state: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({ email: text(formData, "email"), password: text(formData, "password") });
  if (!parsed.success) return { error: issue(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "Correo o contraseña incorrectos." };
  redirect("/");
}

export async function signup(_state: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signupSchema.safeParse({
    fullName: text(formData, "fullName"),
    email: text(formData, "email"),
    password: text(formData, "password"),
    organizationName: text(formData, "organizationName"),
    organizationSlug: text(formData, "organizationSlug"),
  });
  if (!parsed.success) return { error: issue(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.fullName } },
  });
  if (error) return { error: error.message };
  const { error: orgError } = await supabase.rpc("create_organization", {
    p_name: parsed.data.organizationName,
    p_slug: parsed.data.organizationSlug,
  });
  if (orgError) return { error: human(orgError.message) };
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function createMember(_state: ActionState, formData: FormData): Promise<ActionState> {
  const gate = await staff();
  if ("error" in gate) return gate;
  if (gate.profile.role === "trainer") return { error: "Solo un administrador puede dar de alta clientes." };
  const parsed = createMemberSchema.safeParse({
    fullName: text(formData, "fullName"),
    nationalId: text(formData, "nationalId"),
    birthDate: text(formData, "birthDate"),
    gender: text(formData, "gender"),
    email: text(formData, "email"),
    phone: text(formData, "phone"),
    membershipEndsOn: text(formData, "membershipEndsOn"),
    planId: text(formData, "planId"),
    paymentMethod: text(formData, "paymentMethod"),
    weightKg: text(formData, "weightKg"),
    heightCm: text(formData, "heightCm"),
    injuries: text(formData, "injuries"),
    illnesses: text(formData, "illnesses"),
    otherNotes: text(formData, "otherNotes"),
  });
  if (!parsed.success) return { error: issue(parsed.error) };
  const weight = measure(parsed.data.weightKg, "El peso");
  const height = measure(parsed.data.heightCm, "El tamaño");
  if ("error" in weight) return { error: weight.error };
  if ("error" in height) return { error: height.error };
  const notes = fitnessNotesText(parsed.data);
  const today = new Date().toISOString().slice(0, 10);
  if (parsed.data.membershipEndsOn < today) return { error: "La membresía no puede vencer antes de hoy." };
  const password = `Energym${Math.floor(1000 + Math.random() * 9000)}`;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.createUser({
      email: parsed.data.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: parsed.data.fullName, phone: parsed.data.phone },
      app_metadata: {
        provisioned_by: "energym-admin",
        organization_id: gate.profile.organization_id,
        role: "member",
      },
    });
    if (error || !data.user) return { error: error?.message ?? "No se pudo crear el cliente." };
    const profileBase = {
      id: data.user.id,
      organization_id: gate.profile.organization_id,
      role: "member" as const,
      full_name: parsed.data.fullName,
      email: parsed.data.email,
      phone: parsed.data.phone,
      birth_date: parsed.data.birthDate ?? null,
      gender: parsed.data.gender ?? null,
      medical_notes: notes,
    };
    let cedulaPending = false;
    let saved = await admin.from("profiles").upsert({ ...profileBase, national_id: parsed.data.nationalId ?? null }).select("qr_code_token").single();
    if (saved.error?.message.includes("national_id")) {
      cedulaPending = true;
      saved = await admin.from("profiles").upsert(profileBase).select("qr_code_token").single();
    }
    if (saved.error) return { error: saved.error.message };
    const invited = await saveMemberInvite(admin, {
      organizationId: gate.profile.organization_id,
      memberId: data.user.id,
      name: parsed.data.fullName,
      email: parsed.data.email,
      password,
    });
    if ("error" in invited) return { error: invited.error };
    const share = {
      name: parsed.data.fullName,
      email: parsed.data.email,
      password,
      pass: saved.data.qr_code_token,
      code: invited.code,
    };
    if (weight.value || height.value) {
      const measured = await gate.supabase.from("body_measurements").insert({
        organization_id: gate.profile.organization_id,
        member_id: data.user.id,
        recorded_by: gate.profile.id,
        weight_kg: weight.value ?? null,
        height_cm: height.value ?? null,
        notes,
      });
      if (measured.error) return { error: measured.error.message, share };
    }
    const subscribed = await gate.supabase.rpc("subscribe_member", {
      p_member_id: data.user.id,
      p_plan_id: parsed.data.planId,
      p_payment_method: parsed.data.paymentMethod,
    });
    if (subscribed.error) return { error: human(subscribed.error.message), share };
    const dated = await gate.supabase
      .from("member_subscriptions")
      .update({ end_date: parsed.data.membershipEndsOn })
      .eq("member_id", data.user.id)
      .eq("status", "active");
    if (dated.error) return { error: dated.error.message, share };
    const cedula = cedulaPending ? " La cédula no se guardó: falta la columna en la base." : "";
    return { ok: `Cliente creado.${cedula}`, share };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo crear el cliente." };
  }
}

export async function attachProvisionedMembers(): Promise<void> {
  const gate = await staff();
  if ("error" in gate || gate.profile.role === "trainer") return;
  const admin = createAdminClient();
  const organizationId = gate.profile.organization_id;
  let page = 1;
  for (;;) {
    const listed = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (listed.error || listed.data.users.length === 0) return;
    const mine = listed.data.users.filter((user) => {
      const meta = user.app_metadata as { provisioned_by?: string; organization_id?: string; role?: string };
      return meta.provisioned_by === "energym-admin" && meta.organization_id === organizationId && meta.role === "member";
    });
    if (mine.length > 0) {
      const ids = mine.map((user) => user.id);
      await admin.from("profiles").update({ organization_id: organizationId, role: "member" }).in("id", ids);
      const existing = await admin.from("profiles").select("id").in("id", ids);
      const known = new Set((existing.data ?? []).map((row) => row.id));
      const missing = mine.filter((user) => !known.has(user.id) && user.email);
      if (missing.length > 0) {
        await admin.from("profiles").insert(
          missing.map((user) => ({
            id: user.id,
            organization_id: organizationId,
            role: "member" as const,
            full_name: typeof user.user_metadata.full_name === "string" ? user.user_metadata.full_name : user.email!.split("@")[0]!,
            email: user.email!,
            phone: typeof user.user_metadata.phone === "string" ? user.user_metadata.phone : null,
          })),
        );
      }
    }
    if (listed.data.users.length < 200) return;
    page += 1;
  }
}

export async function updateMember(_state: ActionState, formData: FormData): Promise<ActionState> {
  const gate = await staff();
  if ("error" in gate) return gate;
  if (gate.profile.role === "trainer") return { error: "Solo un administrador puede editar clientes." };
  const parsed = updateMemberSchema.safeParse({
    memberId: text(formData, "memberId"),
    fullName: text(formData, "fullName"),
    nationalId: text(formData, "nationalId"),
    birthDate: text(formData, "birthDate"),
    gender: text(formData, "gender"),
    email: text(formData, "email"),
    phone: text(formData, "phone"),
    weightKg: text(formData, "weightKg"),
    heightCm: text(formData, "heightCm"),
    injuries: text(formData, "injuries"),
    illnesses: text(formData, "illnesses"),
    otherNotes: text(formData, "otherNotes"),
  });
  if (!parsed.success) return { error: issue(parsed.error) };
  const weight = measure(parsed.data.weightKg, "El peso");
  const height = measure(parsed.data.heightCm, "El tamaño");
  if ("error" in weight) return { error: weight.error };
  if ("error" in height) return { error: height.error };
  const notes = fitnessNotesText(parsed.data);
  try {
    const admin = createAdminClient();
    const { error: authError } = await admin.auth.admin.updateUserById(parsed.data.memberId, {
      email: parsed.data.email,
      user_metadata: { full_name: parsed.data.fullName, phone: parsed.data.phone },
    });
    if (authError) return { error: authError.message };
    const update = {
      full_name: parsed.data.fullName,
      email: parsed.data.email,
      phone: parsed.data.phone,
      birth_date: parsed.data.birthDate ?? null,
      gender: parsed.data.gender ?? null,
      national_id: parsed.data.nationalId ?? null,
      medical_notes: notes,
    };
    if (weight.value || height.value) {
      const measured = await gate.supabase.from("body_measurements").insert({
        organization_id: gate.profile.organization_id,
        member_id: parsed.data.memberId,
        recorded_by: gate.profile.id,
        weight_kg: weight.value ?? null,
        height_cm: height.value ?? null,
        notes,
      });
      if (measured.error) return { error: measured.error.message };
    }
    const saved = await gate.supabase.from("profiles").update(update).eq("id", parsed.data.memberId);
    if (saved.error?.message.includes("national_id")) {
      const { national_id: _ignored, ...withoutId } = update;
      const retry = await gate.supabase.from("profiles").update(withoutId).eq("id", parsed.data.memberId);
      if (retry.error) return { error: retry.error.message };
      return { ok: "Cliente actualizado. La cédula no se guardó: falta la columna en la base." };
    }
    if (saved.error) return { error: saved.error.message };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo editar el cliente." };
  }
  return { ok: "Cliente actualizado." };
}

export async function shareMemberAccess(_state: ActionState, formData: FormData): Promise<ActionState> {
  const gate = await staff();
  if ("error" in gate) return gate;
  if (gate.profile.role === "trainer") return { error: "Solo un administrador puede compartir el acceso." };
  const memberId = text(formData, "memberId");
  const { data: member, error } = await gate.supabase
    .from("profiles")
    .select("id, full_name, email, qr_code_token, role")
    .eq("id", memberId)
    .single();
  if (error || !member || member.role !== "member") return { error: "No se encontró el cliente." };
  const password = `Energym${Math.floor(1000 + Math.random() * 9000)}`;
  try {
    const admin = createAdminClient();
    const { error: authError } = await admin.auth.admin.updateUserById(member.id, { password });
    if (authError) return { error: authError.message };
    const invited = await saveMemberInvite(admin, {
      organizationId: gate.profile.organization_id,
      memberId: member.id,
      name: member.full_name,
      email: member.email,
      password,
    });
    if ("error" in invited) return { error: invited.error };
    return {
      ok: "Enlace listo. La contraseña anterior ya no sirve.",
      share: { name: member.full_name, email: member.email, password, pass: member.qr_code_token, code: invited.code },
    };
  } catch (authError) {
    return { error: authError instanceof Error ? authError.message : "No se pudo preparar el acceso." };
  }
}

export async function deleteMember(_state: ActionState, formData: FormData): Promise<ActionState> {
  const gate = await staff();
  if ("error" in gate) return gate;
  if (gate.profile.role === "trainer") return { error: "Solo un administrador puede eliminar clientes." };
  const memberId = text(formData, "memberId");
  if (!memberId || memberId === gate.profile.id) return { error: "No se puede eliminar esta cuenta." };
  const { data: member, error } = await gate.supabase.from("profiles").select("id, full_name, role, organization_id").eq("id", memberId).single();
  if (error || !member || member.role !== "member" || member.organization_id !== gate.profile.organization_id) return { error: "No se encontró el cliente." };
  try {
    const admin = createAdminClient();
    const named = await admin.from("payments").update({ member_name: member.full_name }).eq("member_id", memberId);
    if (named.error) return { error: named.error.message };
    const redemptions = await admin.from("promotion_redemptions").delete().eq("member_id", memberId);
    if (redemptions.error) return { error: redemptions.error.message };
    const removedPlans = await admin.from("member_subscriptions").delete().eq("member_id", memberId);
    if (removedPlans.error) return { error: removedPlans.error.message };
    const { error: authError } = await admin.auth.admin.deleteUser(memberId);
    if (authError) return { error: authError.message };
  } catch (deleteError) {
    return { error: deleteError instanceof Error ? deleteError.message : "No se pudo eliminar el cliente." };
  }
  return { ok: "Cliente eliminado." };
}

export async function savePlan(_state: ActionState, formData: FormData): Promise<ActionState> {
  const gate = await staff();
  if ("error" in gate) return gate;
  const parsed = membershipPlanSchema.safeParse({
    name: text(formData, "name"),
    description: text(formData, "description"),
    price: Number(text(formData, "price")),
    durationDays: Number(text(formData, "durationDays")),
    classCredits: Number(text(formData, "classCredits") || 0),
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) return { error: issue(parsed.error) };
  const values = {
    name: parsed.data.name,
    description: parsed.data.description || null,
    price: parsed.data.price,
    duration_days: parsed.data.durationDays,
    class_credits: parsed.data.classCredits,
    is_active: parsed.data.isActive,
  };
  const planId = text(formData, "planId");
  if (planId) {
    const { error } = await gate.supabase.from("membership_plans").update(values).eq("id", planId);
    if (error) return { error: human(error.message) };
    return { ok: "Plan actualizado." };
  }
  const { error } = await gate.supabase.from("membership_plans").insert({
    organization_id: gate.profile.organization_id,
    ...values,
  });
  if (error) return { error: human(error.message) };
  return { ok: "Plan guardado." };
}

export async function saveNews(_state: ActionState, formData: FormData): Promise<ActionState> {
  const gate = await staff();
  if ("error" in gate) return gate;
  const parsed = newsPostSchema.safeParse({
    title: text(formData, "title"),
    body: text(formData, "body"),
    isPublished: formData.get("isPublished") === "on",
  });
  if (!parsed.success) return { error: issue(parsed.error) };
  const values: {
    title: string;
    body: string;
    is_published: boolean;
    image_url?: string | null;
  } = {
    title: parsed.data.title,
    body: parsed.data.body,
    is_published: parsed.data.isPublished,
  };
  const image = newsImage(formData, gate.profile.organization_id);
  if (image.error) return { error: image.error };
  if (image.url !== undefined) values.image_url = image.url;
  const newsId = text(formData, "newsId");
  if (newsId) {
    const { error } = await gate.supabase.from("news_posts").update(values).eq("id", newsId).eq("organization_id", gate.profile.organization_id);
    if (error) return { error: human(error.message) };
    return { ok: "Noticia actualizada." };
  }
  const { error } = await gate.supabase.from("news_posts").insert({
    organization_id: gate.profile.organization_id,
    ...values,
  });
  if (error) return { error: human(error.message) };
  return { ok: "Noticia publicada." };
}

export async function deleteNews(_state: ActionState, formData: FormData): Promise<ActionState> {
  const gate = await staff();
  if ("error" in gate) return gate;
  const newsId = text(formData, "newsId");
  if (!newsId) return { error: "No se encontró la noticia." };
  const { error } = await gate.supabase.from("news_posts").delete().eq("id", newsId).eq("organization_id", gate.profile.organization_id);
  if (error) return { error: human(error.message) };
  return { ok: "Noticia eliminada." };
}

export async function savePayment(_state: ActionState, formData: FormData): Promise<ActionState> {
  const gate = await staff();
  if ("error" in gate) return gate;
  if (gate.profile.role === "trainer") return { error: "Solo un administrador puede registrar pagos." };
  const parsed = paymentSchema.safeParse({
    memberId: text(formData, "memberId"),
    subscriptionId: text(formData, "subscriptionId"),
    originalAmount: Number(text(formData, "originalAmount")),
    discountAmount: Number(text(formData, "discountAmount") || 0),
    paymentMethod: text(formData, "paymentMethod"),
    referenceNumber: text(formData, "referenceNumber"),
    paidAt: text(formData, "paidAt"),
  });
  if (!parsed.success) return { error: issue(parsed.error) };
  if (parsed.data.discountAmount > parsed.data.originalAmount) return { error: "El descuento no puede superar el monto." };
  const paidAt = new Date(parsed.data.paidAt);
  if (Number.isNaN(paidAt.getTime())) return { error: "La fecha del pago no es válida." };
  const { data: subscription, error: subscriptionError } = await gate.supabase
    .from("member_subscriptions")
    .select("id, member_id, organization_id")
    .eq("id", parsed.data.subscriptionId)
    .eq("member_id", parsed.data.memberId)
    .maybeSingle();
  if (subscriptionError || !subscription || subscription.organization_id !== gate.profile.organization_id) {
    return { error: "La suscripción no pertenece a este cliente." };
  }
  const original = Math.round(parsed.data.originalAmount * 100) / 100;
  const discount = Math.round(parsed.data.discountAmount * 100) / 100;
  const values = {
    member_id: parsed.data.memberId,
    subscription_id: parsed.data.subscriptionId,
    original_amount: original,
    discount_amount: discount,
    final_amount: Math.round((original - discount) * 100) / 100,
    payment_method: parsed.data.paymentMethod,
    reference_number: parsed.data.referenceNumber ?? null,
    paid_at: paidAt.toISOString(),
  };
  try {
    const admin = createAdminClient();
    const paymentId = text(formData, "paymentId");
    if (paymentId) {
      const current = await admin.from("payments").select("organization_id").eq("id", paymentId).maybeSingle();
      if (current.error || !current.data || current.data.organization_id !== gate.profile.organization_id) {
        return { error: "No se encontró el pago." };
      }
      const { error } = await admin.from("payments").update(values).eq("id", paymentId);
      if (error) return { error: human(error.message) };
      return { ok: "Pago actualizado." };
    }
    const { error } = await admin.from("payments").insert({
      organization_id: gate.profile.organization_id,
      ...values,
    });
    if (error) return { error: human(error.message) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo guardar el pago." };
  }
  return { ok: "Pago registrado." };
}

export async function savePromotion(_state: ActionState, formData: FormData): Promise<ActionState> {
  const gate = await staff();
  if ("error" in gate) return gate;
  const plans = formData.getAll("planId").filter((value): value is string => typeof value === "string" && value.length > 0);
  const max = text(formData, "maxRedemptions");
  const parsed = promotionSchema.safeParse({
    code: text(formData, "code"),
    title: text(formData, "title"),
    description: text(formData, "description"),
    discountType: text(formData, "discountType"),
    discountValue: Number(text(formData, "discountValue")),
    applicablePlanIds: plans,
    targetAudience: text(formData, "targetAudience") || "all",
    startsAt: new Date(text(formData, "startsAt")).toISOString(),
    endsAt: new Date(text(formData, "endsAt")).toISOString(),
    maxRedemptions: max ? Number(max) : null,
    maxPerMember: Number(text(formData, "maxPerMember") || 1),
    showInMobileApp: formData.get("showInMobileApp") === "on",
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) return { error: issue(parsed.error) };
  const values = {
    code: parsed.data.code,
    title: parsed.data.title,
    description: parsed.data.description || null,
    discount_type: parsed.data.discountType,
    discount_value: parsed.data.discountValue,
    target_audience: parsed.data.targetAudience,
    starts_at: parsed.data.startsAt,
    ends_at: parsed.data.endsAt,
    max_redemptions: parsed.data.maxRedemptions,
    max_per_member: parsed.data.maxPerMember,
    show_in_mobile_app: parsed.data.showInMobileApp,
    is_active: parsed.data.isActive,
  };
  const promotionId = text(formData, "promotionId");
  if (promotionId) {
    const { error } = await gate.supabase.from("promotions").update(values).eq("id", promotionId);
    if (error) return { error: human(error.message) };
    return { ok: "Promoción actualizada." };
  }
  const { error } = await gate.supabase.from("promotions").insert({
    organization_id: gate.profile.organization_id,
    applicable_plan_ids: parsed.data.applicablePlanIds,
    ...values,
  });
  if (error) return { error: human(error.message) };
  return { ok: "Promoción publicada." };
}

export async function saveExercise(_state: ActionState, formData: FormData): Promise<ActionState> {
  const gate = await staff();
  if ("error" in gate) return gate;
  const parsed = exerciseSchema.safeParse({
    name: text(formData, "name"),
    muscleGroup: text(formData, "muscleGroup"),
    equipment: text(formData, "equipment"),
    difficulty: text(formData, "difficulty") || "beginner",
    instructions: text(formData, "instructions"),
    videoUrl: text(formData, "videoUrl"),
  });
  if (!parsed.success) return { error: issue(parsed.error) };
  const { error } = await gate.supabase.from("exercises_library").insert({
    organization_id: gate.profile.organization_id,
    name: parsed.data.name,
    muscle_group: parsed.data.muscleGroup,
    equipment: parsed.data.equipment || null,
    difficulty: parsed.data.difficulty,
    instructions: parsed.data.instructions || null,
    video_url: parsed.data.videoUrl || null,
  });
  if (error) return { error: human(error.message) };
  return { ok: "Ejercicio agregado a la biblioteca." };
}

export async function saveRoutine(_state: ActionState, formData: FormData): Promise<ActionState> {
  const gate = await staff();
  if ("error" in gate) return gate;
  let payload: unknown;
  try {
    payload = JSON.parse(text(formData, "payload"));
  } catch {
    return { error: "La rutina no tiene un formato válido." };
  }
  const parsed = saveRoutineSchema.safeParse(payload);
  if (!parsed.success) return { error: issue(parsed.error) };
  const ids = [...new Set(parsed.data.days.flatMap((day) => day.exercises.map((exercise) => exercise.exercise_id)))];
  const { data: catalog } = await gate.supabase.from("exercises_library").select("id").in("id", ids);
  const allowed = new Set((catalog ?? []).map((row) => row.id));
  if (ids.some((id) => !allowed.has(id))) return { error: "La rutina incluye ejercicios que no están en la biblioteca." };
  const routineId = parsed.data.routineId;
  let savedId = routineId;
  if (routineId) {
    const existing = await gate.supabase.from("routines").select("id").eq("id", routineId).eq("organization_id", gate.profile.organization_id).maybeSingle();
    if (!existing.data) return { error: "No se encontró la rutina." };
    const updated = await gate.supabase.from("routines").update({
      member_id: parsed.data.memberId,
      trainer_id: gate.profile.id,
      name: parsed.data.name,
      goal: parsed.data.goal,
      generated_by_ai: parsed.data.generatedByAi,
      ai_prompt_context: parsed.data.aiPromptContext as Json,
    }).eq("id", routineId);
    if (updated.error) return { error: human(updated.error.message) };
    const removed = await gate.supabase.from("routine_days").delete().eq("routine_id", routineId);
    if (removed.error) return { error: human(removed.error.message) };
  } else {
    await gate.supabase.from("routines").update({ is_active: false }).eq("member_id", parsed.data.memberId).eq("is_active", true);
    const { data: routine, error } = await gate.supabase
      .from("routines")
      .insert({
        organization_id: gate.profile.organization_id,
        member_id: parsed.data.memberId,
        trainer_id: gate.profile.id,
        name: parsed.data.name,
        goal: parsed.data.goal,
        generated_by_ai: parsed.data.generatedByAi,
        ai_prompt_context: parsed.data.aiPromptContext as Json,
        is_active: true,
        start_date: new Date().toISOString().slice(0, 10),
      })
      .select("id")
      .single();
    if (error || !routine) return { error: human(error?.message ?? "No se pudo guardar la rutina.") };
    savedId = routine.id;
  }
  if (!savedId) return { error: "No se pudo guardar la rutina." };
  for (const day of parsed.data.days) {
    const { data: savedDay, error: dayError } = await gate.supabase
      .from("routine_days")
      .insert({
        organization_id: gate.profile.organization_id,
        routine_id: savedId,
        day_number: day.day_number,
        name: day.name,
        focus_area: day.focus_area,
      })
      .select("id")
      .single();
    if (dayError || !savedDay) return { error: human(dayError?.message ?? "No se pudo guardar un día.") };
    const { error: exerciseError } = await gate.supabase.from("routine_exercises").insert(
      day.exercises.map((exercise) => ({
        organization_id: gate.profile.organization_id,
        routine_day_id: savedDay.id,
        exercise_id: exercise.exercise_id,
        order_index: exercise.order_index,
        sets: exercise.sets,
        reps: exercise.reps,
        rest_seconds: exercise.rest_seconds,
        target_rpe: exercise.target_rpe,
        trainer_notes: exercise.trainer_notes,
      })),
    );
    if (exerciseError) return { error: human(exerciseError.message) };
  }
  return { ok: routineId ? "Rutina actualizada." : "Rutina asignada." };
}

export async function subscribeMember(_state: ActionState, formData: FormData): Promise<ActionState> {
  const gate = await staff();
  if ("error" in gate) return gate;
  const parsed = subscribeSchema.safeParse({
    memberId: text(formData, "memberId"),
    planId: text(formData, "planId"),
    paymentMethod: text(formData, "paymentMethod"),
    referenceNumber: text(formData, "referenceNumber"),
    promotionCode: text(formData, "promotionCode"),
  });
  if (!parsed.success) return { error: issue(parsed.error) };
  const code = parsed.data.promotionCode;
  const { data, error } = code
    ? await gate.supabase.rpc("redeem_promotion_code", {
        p_code: code,
        p_member_id: parsed.data.memberId,
        p_plan_id: parsed.data.planId,
        p_payment_method: parsed.data.paymentMethod,
        p_reference_number: parsed.data.referenceNumber || null,
      })
    : await gate.supabase.rpc("subscribe_member", {
        p_member_id: parsed.data.memberId,
        p_plan_id: parsed.data.planId,
        p_payment_method: parsed.data.paymentMethod,
        p_reference_number: parsed.data.referenceNumber || null,
      });
  if (error) return { error: human(error.message) };
  return { ok: "Membresía activada.", detail: JSON.stringify(data) };
}

export async function saveMeasurement(_state: ActionState, formData: FormData): Promise<ActionState> {
  const gate = await staff();
  if ("error" in gate) return gate;
  const optional = (key: string) => {
    const value = text(formData, key);
    return value ? Number(value) : null;
  };
  const parsed = measurementSchema.safeParse({
    memberId: text(formData, "memberId"),
    weightKg: optional("weightKg"),
    bodyFatPct: optional("bodyFatPct"),
    waistCm: optional("waistCm"),
    notes: text(formData, "notes"),
  });
  if (!parsed.success) return { error: issue(parsed.error) };
  const { error } = await gate.supabase.from("body_measurements").insert({
    organization_id: gate.profile.organization_id,
    member_id: parsed.data.memberId,
    recorded_by: gate.profile.id,
    weight_kg: parsed.data.weightKg,
    body_fat_pct: parsed.data.bodyFatPct,
    waist_cm: parsed.data.waistCm,
    notes: parsed.data.notes || null,
  });
  if (error) return { error: human(error.message) };
  return { ok: "Medidas registradas." };
}

export async function saveClass(_state: ActionState, formData: FormData): Promise<ActionState> {
  const gate = await staff();
  if ("error" in gate) return gate;
  const parsed = classScheduleSchema.safeParse({
    scheduleId: text(formData, "scheduleId") || undefined,
    classTypeId: text(formData, "classTypeId"),
    trainerId: text(formData, "trainerId") || null,
    startTime: text(formData, "startTime"),
    endTime: text(formData, "endTime"),
    maxCapacity: Number(text(formData, "maxCapacity")),
    occurrences: Number(text(formData, "occurrences") || 1),
  });
  if (!parsed.success) return { error: issue(parsed.error) };
  if (parsed.data.scheduleId) {
    const reserved = await gate.supabase.from("class_bookings").select("id", { count: "exact", head: true }).eq("class_schedule_id", parsed.data.scheduleId).eq("status", "confirmed");
    if (reserved.error) return { error: human(reserved.error.message) };
    if ((reserved.count ?? 0) > parsed.data.maxCapacity) return { error: "El cupo no puede ser menor que las reservas confirmadas." };
    const { error } = await gate.supabase.from("class_schedules").update({
      class_type_id: parsed.data.classTypeId,
      trainer_id: parsed.data.trainerId,
      start_time: new Date(parsed.data.startTime).toISOString(),
      end_time: new Date(parsed.data.endTime).toISOString(),
      max_capacity: parsed.data.maxCapacity,
    }).eq("id", parsed.data.scheduleId).eq("organization_id", gate.profile.organization_id);
    if (error) return { error: human(error.message) };
    return { ok: "Clase actualizada." };
  }
  const seriesId = crypto.randomUUID();
  const start = new Date(parsed.data.startTime);
  const end = new Date(parsed.data.endTime);
  const week = 7 * 24 * 60 * 60 * 1000;
  const rows = Array.from({ length: parsed.data.occurrences }, (_, index) => ({
    organization_id: gate.profile.organization_id,
    class_type_id: parsed.data.classTypeId,
    trainer_id: parsed.data.trainerId,
    series_id: seriesId,
    start_time: new Date(start.getTime() + index * week).toISOString(),
    end_time: new Date(end.getTime() + index * week).toISOString(),
    max_capacity: parsed.data.maxCapacity,
  }));
  const { error } = await gate.supabase.from("class_schedules").insert(rows);
  if (error) return { error: human(error.message) };
  return { ok: "Clases programadas." };
}

export async function checkIn(_state: ActionState, formData: FormData): Promise<ActionState> {
  const gate = await staff();
  if ("error" in gate) return gate;
  const { data, error } = await gate.supabase.rpc("check_in_member", {
    p_qr_token: text(formData, "token") || null,
    p_member_id: text(formData, "memberId") || null,
  });
  if (error) return { error: human(error.message) };
  const result = data as { full_name?: string; status?: string; membership_end?: string | null };
  const labels: Record<string, string> = {
    granted: "Acceso concedido",
    denied_expired: "Membresía vencida",
    denied_suspended: "Cliente suspendido",
  };
  return {
    ok: `${labels[result.status ?? ""] ?? "Resultado"}: ${result.full_name ?? "cliente"}`,
    detail: result.membership_end ? `Vence ${result.membership_end}` : undefined,
  };
}

export async function markAttendance(formData: FormData): Promise<ActionState> {
  const gate = await staff();
  if ("error" in gate) return gate;
  const status = text(formData, "status");
  if (status !== "attended" && status !== "no_show") return { error: "Estado inválido." };
  const { error } = await gate.supabase.rpc("mark_booking_attendance", {
    p_booking_id: text(formData, "bookingId"),
    p_status: status,
  });
  if (error) return { error: human(error.message) };
  return { ok: "Asistencia registrada." };
}

export async function updateMedicalNotes(_state: ActionState, formData: FormData): Promise<ActionState> {
  const gate = await staff();
  if ("error" in gate) return gate;
  const status = text(formData, "status");
  if (status !== "active" && status !== "suspended" && status !== "inactive") return { error: "Estado inválido." };
  const { error } = await gate.supabase
    .from("profiles")
    .update({ medical_notes: text(formData, "medicalNotes") || null, status })
    .eq("id", text(formData, "memberId"));
  if (error) return { error: human(error.message) };
  return { ok: "Ficha actualizada." };
}
