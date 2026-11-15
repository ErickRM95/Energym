import { useQuery } from "@tanstack/react-query";
import { Image, ScrollView, Text, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { tipsForToday } from "@/lib/wellness-tips";

export default function HomeScreen() {
  const home = useQuery({
    queryKey: ["home"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", auth.user.id).single();
      const { data: subscription } = await supabase
        .from("member_subscriptions")
        .select("end_date")
        .eq("member_id", auth.user.id)
        .eq("status", "active")
        .order("end_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      const [promos, news] = await Promise.all([
        supabase.from("promotions").select("id, title, description, code").eq("show_in_mobile_app", true).eq("is_active", true),
        supabase.from("news_posts").select("id, title, body, image_url, published_at").eq("is_published", true).order("published_at", { ascending: false }),
      ]);
      return { profile, subscription, promos: promos.data ?? [], news: news.data ?? [] };
    },
  });

  const end = home.data?.subscription?.end_date;
  const days = end ? Math.max(0, Math.ceil((new Date(end).getTime() - Date.now()) / 86400000)) : null;
  const tips = tipsForToday();

  return (
    <ScrollView className="flex-1 bg-[#f3f4ef] dark:bg-[#101410]" contentContainerClassName="gap-4 px-5 py-6">
      <Text className="text-3xl font-semibold text-[#161915] dark:text-white">Hola, {home.data?.profile?.full_name ?? "atleta"}</Text>
      <Text className="text-[#3d5c0a] dark:text-[#c6f135]">{days === null ? "Sin membresía activa" : `${days} días de membresía`}</Text>
      {(home.data?.news.length ?? 0) > 0 ? (
        <View className="gap-3">
          <Text className="text-lg font-semibold text-[#161915] dark:text-white">Noticias</Text>
          {home.data?.news.map((item) => (
            <View key={item.id} className="overflow-hidden rounded-3xl bg-[#fffcf6] dark:bg-[#1c241c]">
              {item.image_url ? (
                <Image source={{ uri: item.image_url }} accessibilityLabel={item.title} resizeMode="cover" style={{ width: "100%", height: 180 }} />
              ) : null}
              <View className="p-4">
              <Text className="text-xs tracking-[2px] text-[#3d5c0a] dark:text-[#c6f135]">
                {new Intl.DateTimeFormat("es-CR", { dateStyle: "medium" }).format(new Date(item.published_at))}
              </Text>
              <Text className="mt-2 text-base font-semibold text-[#161915] dark:text-white">{item.title}</Text>
              <Text className="mt-1 text-sm leading-5 text-[#5c655b] dark:text-[#c9d2c8]">{item.body}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}
      <View className="gap-3">
        <Text className="text-lg font-semibold text-[#161915] dark:text-white">Consejos de hoy</Text>
        {tips.map((tip) => (
          <View key={tip.topic} className="rounded-3xl bg-[#fffcf6] dark:bg-[#1c241c] p-4">
            <Text className="text-xs tracking-[2px] text-[#3d5c0a] dark:text-[#c6f135]">{tip.topic.toUpperCase()}</Text>
            <Text className="mt-2 text-base font-semibold text-[#161915] dark:text-white">{tip.title}</Text>
            <Text className="mt-1 text-sm leading-5 text-[#5c655b] dark:text-[#c9d2c8]">{tip.body}</Text>
          </View>
        ))}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3">
        {(home.data?.promos ?? []).map((promo) => (
          <View key={promo.id} className="w-64 rounded-3xl bg-[#fffcf6] dark:bg-[#1c241c] p-4">
            <Text className="text-lg font-semibold text-[#161915] dark:text-white">{promo.title}</Text>
            <Text className="mt-1 text-sm text-[#5c655b] dark:text-[#c9d2c8]">{promo.description}</Text>
            <Text className="mt-3 text-[#3d5c0a] dark:text-[#c6f135]">{promo.code}</Text>
          </View>
        ))}
      </ScrollView>
    </ScrollView>
  );
}
