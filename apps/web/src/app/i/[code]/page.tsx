import { Suspense } from "react";
import { InviteCard } from "@/components/invite-card";
import { createAdminClient } from "@/lib/supabase/admin";

async function InviteContent({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!/^[a-z0-9]{8}$/.test(code)) return <InviteCard nombre="" correo="" clave="" />;
  const { data } = await createAdminClient().from("member_invites").select("full_name, email, access_password").eq("code", code).maybeSingle();
  if (!data) return <InviteCard nombre="" correo="" clave="" />;
  return <InviteCard nombre={data.full_name} correo={data.email} clave={data.access_password} />;
}

export default function ShortInvitePage({ params }: { params: Promise<{ code: string }> }) {
  return (
    <Suspense fallback={null}>
      <InviteContent params={params} />
    </Suspense>
  );
}
