import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { data, error } = await supabase
    .from("payments")
    .select("paid_at, original_amount, discount_amount, final_amount, payment_method, reference_number, member_id")
    .order("paid_at", { ascending: false });
  if (error) return new Response(error.message, { status: 400 });
  const header = "paid_at,member_id,original_amount,discount_amount,final_amount,payment_method,reference_number";
  const lines = (data ?? []).map((row) =>
    [row.paid_at, row.member_id, row.original_amount, row.discount_amount, row.final_amount, row.payment_method, row.reference_number ?? ""].join(","),
  );
  return new Response([header, ...lines].join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=energym-pagos.csv",
    },
  });
}
