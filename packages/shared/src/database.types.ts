export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Table<Row extends Record<string, unknown>> = {
  Row: Row;
  Insert: { [K in keyof Row]?: Row[K] | undefined };
  Update: { [K in keyof Row]?: Row[K] | undefined };
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      organizations: Table<{
        id: string;
        name: string;
        slug: string;
        logo_url: string | null;
        timezone: string;
        currency: string;
        ai_routines_enabled: boolean;
        created_at: string;
        updated_at: string;
      }>;
      profiles: Table<{
        id: string;
        organization_id: string | null;
        role: "super_admin" | "gym_admin" | "trainer" | "member";
        full_name: string;
        email: string;
        phone: string | null;
        national_id: string | null;
        birth_date: string | null;
        gender: string | null;
        medical_notes: string | null;
        status: "active" | "suspended" | "inactive";
        qr_code_token: string;
        avatar_url: string | null;
        created_at: string;
        updated_at: string;
      }>;
      membership_plans: Table<{
        id: string;
        organization_id: string;
        name: string;
        description: string | null;
        price: number;
        duration_days: number;
        class_credits: number;
        is_active: boolean;
        created_at: string;
        updated_at: string;
      }>;
      promotions: Table<{
        id: string;
        organization_id: string;
        code: string;
        title: string;
        description: string | null;
        banner_url: string | null;
        discount_type: "percentage" | "fixed_amount" | "extra_days" | "extra_credits";
        discount_value: number;
        applicable_plan_ids: string[];
        target_audience: "all" | "new_members" | "renewals";
        starts_at: string;
        ends_at: string;
        max_redemptions: number | null;
        max_per_member: number;
        current_redemptions: number;
        show_in_mobile_app: boolean;
        is_active: boolean;
        created_at: string;
        updated_at: string;
      }>;
      news_posts: Table<{
        id: string;
        organization_id: string;
        title: string;
        body: string;
        image_url: string | null;
        is_published: boolean;
        published_at: string;
        created_at: string;
        updated_at: string;
      }>;
      member_invites: Table<{
        code: string;
        organization_id: string;
        member_id: string;
        full_name: string;
        email: string;
        access_password: string;
        created_at: string;
      }>;
      member_subscriptions: Table<{
        id: string;
        organization_id: string;
        member_id: string;
        plan_id: string;
        promotion_id: string | null;
        start_date: string;
        end_date: string;
        remaining_credits: number;
        status: "active" | "expired" | "pending_payment" | "cancelled";
        created_at: string;
        updated_at: string;
      }>;
      payments: Table<{
        id: string;
        organization_id: string;
        subscription_id: string;
        member_id: string;
        original_amount: number;
        discount_amount: number;
        final_amount: number;
        payment_method: string;
        reference_number: string | null;
        paid_at: string | null;
        created_at: string;
      }>;
      promotion_redemptions: Table<{
        id: string;
        organization_id: string;
        promotion_id: string;
        member_id: string;
        subscription_id: string;
        original_amount: number;
        discount_applied: number;
        final_amount: number;
        redeemed_at: string;
      }>;
      exercises_library: Table<{
        id: string;
        organization_id: string | null;
        name: string;
        muscle_group: string;
        equipment: string | null;
        difficulty: "beginner" | "intermediate" | "advanced";
        instructions: string | null;
        video_url: string | null;
        thumbnail_url: string | null;
        is_active: boolean;
        created_at: string;
        updated_at: string;
      }>;
      routines: Table<{
        id: string;
        organization_id: string;
        member_id: string;
        trainer_id: string | null;
        name: string;
        goal: string;
        generated_by_ai: boolean;
        ai_prompt_context: Json | null;
        start_date: string | null;
        end_date: string | null;
        is_active: boolean;
        created_at: string;
        updated_at: string;
      }>;
      routine_days: Table<{
        id: string;
        organization_id: string;
        routine_id: string;
        day_number: number;
        name: string;
        focus_area: string | null;
      }>;
      routine_exercises: Table<{
        id: string;
        organization_id: string;
        routine_day_id: string;
        exercise_id: string;
        order_index: number;
        sets: number;
        reps: string;
        rest_seconds: number;
        target_rpe: number | null;
        trainer_notes: string | null;
      }>;
      workout_logs: Table<{
        id: string;
        organization_id: string;
        member_id: string;
        routine_exercise_id: string;
        set_number: number;
        weight_kg: number | null;
        reps_completed: number;
        logged_at: string;
      }>;
      class_types: Table<{
        id: string;
        organization_id: string;
        name: string;
        description: string | null;
        color_hex: string;
        duration_minutes: number;
        created_at: string;
        updated_at: string;
      }>;
      class_schedules: Table<{
        id: string;
        organization_id: string;
        class_type_id: string;
        trainer_id: string | null;
        series_id: string | null;
        start_time: string;
        end_time: string;
        max_capacity: number;
        status: "scheduled" | "cancelled" | "completed";
        created_at: string;
        updated_at: string;
      }>;
      class_bookings: Table<{
        id: string;
        organization_id: string;
        class_schedule_id: string;
        member_id: string;
        status: "confirmed" | "waitlist" | "cancelled" | "attended" | "no_show";
        credits_charged: number;
        booked_at: string;
        checked_in_at: string | null;
      }>;
      gym_access_logs: Table<{
        id: string;
        organization_id: string;
        member_id: string;
        checked_in_at: string;
        access_method: "qr_scan" | "manual";
        status: "granted" | "denied_expired" | "denied_suspended";
      }>;
      body_measurements: Table<{
        id: string;
        organization_id: string;
        member_id: string;
        recorded_by: string | null;
        recorded_at: string;
        weight_kg: number | null;
        height_cm: number | null;
        body_fat_pct: number | null;
        muscle_mass_kg: number | null;
        chest_cm: number | null;
        waist_cm: number | null;
        hips_cm: number | null;
        arm_cm: number | null;
        thigh_cm: number | null;
        notes: string | null;
      }>;
      progress_photos: Table<{
        id: string;
        organization_id: string;
        member_id: string;
        measurement_id: string | null;
        photo_url: string;
        angle: "front" | "side" | "back";
        taken_at: string;
      }>;
      push_tokens: Table<{
        id: string;
        organization_id: string;
        profile_id: string;
        expo_token: string;
        platform: string | null;
        created_at: string;
      }>;
    };
    Views: Record<string, never>;
    Functions: {
      book_class_slot: {
        Args: { p_class_schedule_id: string; p_member_id?: string | null };
        Returns: Json;
      };
      cancel_class_booking: { Args: { p_booking_id: string }; Returns: Json };
      check_in_member: {
        Args: { p_qr_token?: string | null; p_member_id?: string | null };
        Returns: Json;
      };
      create_organization: {
        Args: { p_name: string; p_slug: string; p_timezone?: string; p_currency?: string };
        Returns: string;
      };
      mark_booking_attendance: {
        Args: { p_booking_id: string; p_status: "attended" | "no_show" };
        Returns: Json;
      };
      preview_promotion: {
        Args: { p_code: string; p_plan_id: string; p_member_id?: string | null };
        Returns: Json;
      };
      redeem_promotion_code: {
        Args: {
          p_code: string;
          p_member_id: string;
          p_plan_id: string;
          p_payment_method: string;
          p_reference_number?: string | null;
        };
        Returns: Json;
      };
      subscribe_member: {
        Args: {
          p_member_id: string;
          p_plan_id: string;
          p_payment_method: string;
          p_reference_number?: string | null;
          p_promotion_code?: string | null;
        };
        Returns: Json;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
