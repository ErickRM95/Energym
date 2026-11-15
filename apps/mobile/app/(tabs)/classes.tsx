import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { supabase } from "@/lib/supabase";

export default function ClassesScreen() {
  const client = useQueryClient();
  const classes = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const { data: schedules } = await supabase
        .from("class_schedules")
        .select("id, start_time, max_capacity, class_type_id")
        .eq("status", "scheduled")
        .gte("start_time", new Date().toISOString())
        .order("start_time");
      const { data: types } = await supabase.from("class_types").select("id, name");
      const { data: mine } = await supabase.from("class_bookings").select("id, class_schedule_id, status").eq("member_id", auth.user?.id ?? "");
      const { data: confirmed } = await supabase.from("class_bookings").select("class_schedule_id").eq("status", "confirmed");
      return { schedules: schedules ?? [], types: types ?? [], mine: mine ?? [], confirmed: confirmed ?? [] };
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("class-capacity")
      .on("postgres_changes", { event: "*", schema: "public", table: "class_bookings" }, () => {
        void client.invalidateQueries({ queryKey: ["classes"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [client]);

  async function book(scheduleId: string) {
    await supabase.rpc("book_class_slot", { p_class_schedule_id: scheduleId });
    void client.invalidateQueries({ queryKey: ["classes"] });
  }

  async function cancel(bookingId: string) {
    await supabase.rpc("cancel_class_booking", { p_booking_id: bookingId });
    void client.invalidateQueries({ queryKey: ["classes"] });
  }

  return (
    <ScrollView className="flex-1 bg-[#f3f4ef] dark:bg-[#101410]" contentContainerClassName="gap-3 px-5 py-6">
      {(classes.data?.schedules ?? []).map((schedule) => {
        const taken = classes.data?.confirmed.filter((row) => row.class_schedule_id === schedule.id).length ?? 0;
        const booking = classes.data?.mine.find((row) => row.class_schedule_id === schedule.id && (row.status === "confirmed" || row.status === "waitlist"));
        return (
          <View key={schedule.id} className="rounded-3xl bg-[#fffcf6] dark:bg-[#1c241c] p-4">
            <Text className="text-xl font-semibold text-[#161915] dark:text-white">{classes.data?.types.find((type) => type.id === schedule.class_type_id)?.name ?? "Clase"}</Text>
            <Text className="mt-1 text-[#5c655b] dark:text-[#c9d2c8]">{new Date(schedule.start_time).toLocaleString("es-MX")} · {taken}/{schedule.max_capacity}</Text>
            {booking ? (
              <Pressable className="mt-3 items-center rounded-full border border-[#d7dacf] dark:border-white/20 py-3" onPress={() => void cancel(booking.id)}>
                <Text className="text-[#161915] dark:text-white">{booking.status === "waitlist" ? "Salir de la espera" : "Cancelar"}</Text>
              </Pressable>
            ) : (
              <Pressable className="mt-3 items-center rounded-full bg-[#c6f135] py-3" onPress={() => void book(schedule.id)}>
                <Text className="font-semibold text-[#142000]">{taken >= schedule.max_capacity ? "Lista de espera" : "Reservar"}</Text>
              </Pressable>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}
