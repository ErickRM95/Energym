import { z } from "zod";
import {
  discountTypes,
  exerciseDifficulties,
  experienceLevels,
  photoAngles,
  targetAudiences,
  trainingGoals,
} from "./enums";

const required = (label: string) => z.string().trim().min(1, { error: `${label} es obligatorio.` });

export const loginSchema = z.object({
  email: z.email({ error: "Ingresa un correo válido." }),
  password: z.string().min(8, { error: "La contraseña debe tener al menos 8 caracteres." }),
});

export const signupSchema = loginSchema.extend({
  fullName: z.string().trim().min(2, { error: "El nombre debe tener al menos 2 caracteres." }),
  organizationName: required("El nombre del gimnasio"),
  organizationSlug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
      error: "Usa un identificador en minúsculas, por ejemplo energym-centro.",
    }),
});

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

export const createMemberSchema = z.object({
  fullName: z.string().trim().min(2, { error: "El nombre es obligatorio." }),
  nationalId: optionalText,
  birthDate: optionalText,
  gender: optionalText,
  email: z.email({ error: "Ingresa un correo válido." }),
  phone: z.string().trim().min(1, { error: "El teléfono es obligatorio." }),
  membershipEndsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Indica cuándo vence la membresía." }),
  planId: z.uuid({ error: "Elige un tipo de membresía." }),
  paymentMethod: z.enum(["cash", "card", "sinpe", "transfer"], { error: "Elige un tipo de pago." }),
  weightKg: optionalText,
  heightCm: optionalText,
  injuries: optionalText,
  illnesses: optionalText,
  otherNotes: optionalText,
});

export const updateMemberSchema = z.object({
  memberId: z.uuid(),
  fullName: z.string().trim().min(2, { error: "El nombre es obligatorio." }),
  nationalId: optionalText,
  birthDate: optionalText,
  gender: optionalText,
  email: z.email({ error: "Ingresa un correo válido." }),
  phone: z.string().trim().min(1, { error: "El teléfono es obligatorio." }),
  weightKg: optionalText,
  heightCm: optionalText,
  injuries: optionalText,
  illnesses: optionalText,
  otherNotes: optionalText,
});

export const newsPostSchema = z.object({
  title: z.string().trim().min(2, { error: "El título es obligatorio." }),
  body: z.string().trim().min(1, { error: "Escribe la noticia." }),
  isPublished: z.boolean(),
});

export const membershipPlanSchema = z.object({
  name: required("El nombre"),
  description: z.string().trim().optional(),
  price: z.number().min(0),
  durationDays: z.number().int().positive(),
  classCredits: z.number().int().min(0),
  isActive: z.boolean().default(true),
});

export const promotionSchema = z.object({
  code: required("El código"),
  title: required("El título"),
  description: z.string().trim().optional(),
  bannerUrl: z.string().trim().optional(),
  discountType: z.enum(discountTypes),
  discountValue: z.number().positive(),
  applicablePlanIds: z.array(z.uuid()).default([]),
  targetAudience: z.enum(targetAudiences).default("all"),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
  maxRedemptions: z.number().int().positive().nullable().default(null),
  maxPerMember: z.number().int().positive().default(1),
  showInMobileApp: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const exerciseSchema = z.object({
  name: required("El nombre"),
  muscleGroup: required("El grupo muscular"),
  equipment: z.string().trim().optional(),
  difficulty: z.enum(exerciseDifficulties).default("beginner"),
  instructions: z.string().trim().optional(),
  videoUrl: z.string().trim().optional(),
  thumbnailUrl: z.string().trim().optional(),
});

export const routineExerciseDraftSchema = z.object({
  exercise_id: z.uuid({ error: "Cada ejercicio debe existir en la biblioteca." }),
  order_index: z.number().int().min(0),
  sets: z.number().int().positive(),
  reps: z.string().trim().min(1),
  rest_seconds: z.number().int().min(0),
  target_rpe: z.number().min(1).max(10).nullable(),
  trainer_notes: z.string().nullable(),
});

export const routineDayDraftSchema = z.object({
  day_number: z.number().int().positive(),
  name: z.string().trim().min(1),
  focus_area: z.string().trim().min(1),
  exercises: z.array(routineExerciseDraftSchema).min(1),
});

export const routineDraftSchema = z.object({
  name: z.string().trim().min(1),
  goal: z.string().trim().min(1),
  days: z.array(routineDayDraftSchema).min(1),
});

export const saveRoutineSchema = routineDraftSchema.extend({
  memberId: z.uuid(),
  routineId: z.uuid().optional(),
  generatedByAi: z.boolean().default(false),
  aiPromptContext: z.record(z.string(), z.unknown()).nullable().default(null),
});

export const aiRoutineRequestSchema = z.object({
  memberId: z.uuid(),
  goal: z.enum(trainingGoals),
  daysPerWeek: z.number().int().min(1).max(7),
  experience: z.enum(experienceLevels),
  sessionMinutes: z.number().int().min(20).max(180),
  injuries: z.string().trim().max(1000).default(""),
});

export const classScheduleSchema = z.object({
  scheduleId: z.uuid().optional(),
  classTypeId: z.uuid(),
  trainerId: z.uuid().nullable().default(null),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  maxCapacity: z.number().int().positive(),
  occurrences: z.number().int().min(1).max(12).default(1),
});

export const measurementSchema = z.object({
  memberId: z.uuid(),
  weightKg: z.number().positive().nullable().default(null),
  heightCm: z.number().positive().nullable().default(null),
  bodyFatPct: z.number().min(0).max(80).nullable().default(null),
  muscleMassKg: z.number().min(0).nullable().default(null),
  chestCm: z.number().positive().nullable().default(null),
  waistCm: z.number().positive().nullable().default(null),
  hipsCm: z.number().positive().nullable().default(null),
  armCm: z.number().positive().nullable().default(null),
  thighCm: z.number().positive().nullable().default(null),
  notes: z.string().trim().optional(),
});

export const paymentSchema = z.object({
  memberId: z.uuid({ error: "Elige un cliente." }),
  planId: z.uuid({ error: "Elige un plan." }),
  originalAmount: z.number().min(0, { error: "El monto no puede ser negativo." }),
  discountAmount: z.number().min(0, { error: "El descuento no puede ser negativo." }),
  paymentMethod: z.enum(["cash", "card", "sinpe", "transfer"], { error: "Elige un tipo de pago." }),
  referenceNumber: optionalText,
  paidAt: z.string().min(1, { error: "Indica la fecha del pago." }),
});

export const subscribeSchema = z.object({
  memberId: z.uuid(),
  planId: z.uuid(),
  paymentMethod: required("El método de pago"),
  referenceNumber: z.string().trim().optional(),
  promotionCode: z.string().trim().optional(),
});

export const progressPhotoSchema = z.object({
  memberId: z.uuid(),
  measurementId: z.uuid().nullable().default(null),
  photoUrl: required("La foto"),
  angle: z.enum(photoAngles),
});

export type RoutineDraft = z.infer<typeof routineDraftSchema>;
export type AiRoutineRequest = z.infer<typeof aiRoutineRequestSchema>;
export type SaveRoutineInput = z.infer<typeof saveRoutineSchema>;

export function assertCatalogExerciseIds(draft: RoutineDraft, allowedIds: ReadonlySet<string>): string[] {
  const unknown: string[] = [];
  for (const day of draft.days) {
    for (const exercise of day.exercises) {
      if (!allowedIds.has(exercise.exercise_id)) unknown.push(exercise.exercise_id);
    }
  }
  return unknown;
}
