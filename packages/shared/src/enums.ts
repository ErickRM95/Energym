export const userRoles = ["super_admin", "gym_admin", "trainer", "member"] as const;
export const profileStatuses = ["active", "suspended", "inactive"] as const;
export const subscriptionStatuses = ["active", "expired", "pending_payment", "cancelled"] as const;
export const discountTypes = ["percentage", "fixed_amount", "extra_days", "extra_credits"] as const;
export const targetAudiences = ["all", "new_members", "renewals"] as const;
export const bookingStatuses = ["confirmed", "waitlist", "cancelled", "attended", "no_show"] as const;
export const scheduleStatuses = ["scheduled", "cancelled", "completed"] as const;
export const accessMethods = ["qr_scan", "manual"] as const;
export const accessStatuses = ["granted", "denied_expired", "denied_suspended"] as const;
export const photoAngles = ["front", "side", "back"] as const;
export const exerciseDifficulties = ["beginner", "intermediate", "advanced"] as const;
export const trainingGoals = ["hipertrofia", "perdida_de_grasa", "fuerza", "resistencia"] as const;
export const experienceLevels = ["beginner", "intermediate", "advanced"] as const;

export type UserRole = (typeof userRoles)[number];
export type DiscountType = (typeof discountTypes)[number];
export type TrainingGoal = (typeof trainingGoals)[number];
export type ExperienceLevel = (typeof experienceLevels)[number];
