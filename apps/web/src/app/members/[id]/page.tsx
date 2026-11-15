import { Suspense } from "react";
import { MemberDetail } from "./member-detail";

async function MemberContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MemberDetail id={id} />;
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p>Cargando ficha…</p>}>
      <MemberContent params={params} />
    </Suspense>
  );
}
