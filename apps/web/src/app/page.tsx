"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui";
import { money } from "@/lib/format";
import { createClient } from "@/lib/supabase/browser";

function isoDate(date: Date) {
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function calendarDate(value: string) {
  const [year, month, dayNumber] = value.slice(0, 10).split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, dayNumber ?? 1);
}

function daysLeft(endDate: string, today: string) {
  return Math.round((calendarDate(endDate).getTime() - calendarDate(today).getTime()) / 86_400_000);
}

export default function DashboardPage() {
  const stats = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const supabase = createClient();
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const todayDate = new Date();
      const weekAhead = new Date(todayDate);
      weekAhead.setDate(weekAhead.getDate() + 7);
      const today = isoDate(todayDate);
      const limit = isoDate(weekAhead);
      const [members, payments, expiring, aiRoutines, schedules, bookings] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "member").eq("status", "active"),
        supabase.from("payments").select("final_amount, discount_amount").gte("paid_at", monthStart.toISOString()),
        supabase.from("member_subscriptions").select("id, member_id, plan_id, end_date").eq("status", "active").gte("end_date", today).lte("end_date", limit).order("end_date"),
        supabase.from("routines").select("id", { count: "exact", head: true }).eq("generated_by_ai", true),
        supabase.from("class_schedules").select("id, max_capacity, start_time").gte("start_time", `${today}T00:00:00`),
        supabase.from("class_bookings").select("class_schedule_id").eq("status", "confirmed"),
      ]);
      const due = expiring.data ?? [];
      const memberIds = [...new Set(due.map((row) => row.member_id))];
      const planIds = [...new Set(due.map((row) => row.plan_id))];
      const [profiles, plans] = await Promise.all([
        memberIds.length > 0 ? supabase.from("profiles").select("id, full_name").in("id", memberIds) : Promise.resolve({ data: [] }),
        planIds.length > 0 ? supabase.from("membership_plans").select("id, name").in("id", planIds) : Promise.resolve({ data: [] }),
      ]);
      const names = new Map((profiles.data ?? []).map((profile) => [profile.id, profile.full_name]));
      const planNames = new Map((plans.data ?? []).map((plan) => [plan.id, plan.name]));
      const gross = (payments.data ?? []).reduce((sum, row) => sum + Number(row.final_amount) + Number(row.discount_amount), 0);
      const discounts = (payments.data ?? []).reduce((sum, row) => sum + Number(row.discount_amount), 0);
      const todaySchedules = (schedules.data ?? []).filter((row) => row.start_time.slice(0, 10) === today);
      const todayIds = new Set(todaySchedules.map((row) => row.id));
      const occupied = (bookings.data ?? []).filter((row) => todayIds.has(row.class_schedule_id)).length;
      const capacity = todaySchedules.reduce((sum, row) => sum + row.max_capacity, 0);
      return {
        members: members.count ?? 0,
        gross,
        discounts,
        expiring: due.map((row) => ({
          id: row.id,
          memberId: row.member_id,
          name: names.get(row.member_id) ?? "Cliente",
          plan: planNames.get(row.plan_id) ?? "Plan",
          endDate: row.end_date,
          days: daysLeft(row.end_date, today),
        })),
        aiRoutines: aiRoutines.count ?? 0,
        occupancy: capacity === 0 ? "Sin clases hoy" : `${occupied}/${capacity}`,
      };
    },
  });
  const cards = [
    ["Clientes activos", String(stats.data?.members ?? "—")],
    ["Ingresos del mes", stats.data ? money(stats.data.gross) : "—"],
    ["Descuentos", stats.data ? money(stats.data.discounts) : "—"],
    ["Ocupación de hoy", stats.data?.occupancy ?? "—"],
    ["Vencen en 7 días", String(stats.data?.expiring.length ?? "—")],
    ["Rutinas con IA", String(stats.data?.aiRoutines ?? "—")],
  ];
  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-6">
      <div>
        <p className="font-mono text-xs tracking-[0.18em] text-muted-foreground">HOY</p>
        <h1 className="text-4xl font-semibold tracking-tight">Tablero</h1>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(([label, value]) => (
          <Card key={label}>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 font-mono text-3xl">{stats.isLoading ? "…" : value}</p>
          </Card>
        ))}
      </div>
      <Card>
        <h2 className="text-lg font-semibold">Clientes próximos a vencer</h2>
        <p className="mt-1 text-sm text-muted-foreground">Mensualidades activas que vencen en los próximos 7 días.</p>
        {stats.data && stats.data.expiring.length === 0 ? (
          <p className="mt-4 text-sm">Ningún cliente vence en los próximos 7 días.</p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-2xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Plan</th>
                  <th className="px-4 py-3 font-medium">Vence</th>
                  <th className="px-4 py-3 font-medium">Plazo</th>
                </tr>
              </thead>
              <tbody>
                {(stats.data?.expiring ?? []).map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <Link href={`/members/${row.memberId}`}>{row.name}</Link>
                    </td>
                    <td className="px-4 py-3">{row.plan}</td>
                    <td className="px-4 py-3">{new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(calendarDate(row.endDate))}</td>
                    <td className="px-4 py-3">{row.days === 0 ? "Hoy" : row.days === 1 ? "Mañana" : `${row.days} días`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </section>
  );
}
