"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { checkIn, type ActionState } from "@/app/actions";
import { FormNote } from "@/components/form-note";
import { Button, Card, Field, Input, Select } from "@/components/ui";
import { when } from "@/lib/format";
import { createClient } from "@/lib/supabase/browser";

type Detector = { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> };

export default function AccessPage() {
  const [state, action, pending] = useActionState<ActionState, FormData>(checkIn, {});
  const [token, setToken] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const logs = useQuery({
    queryKey: ["access-logs"],
    queryFn: async () => {
      const { data, error } = await createClient()
        .from("gym_access_logs")
        .select("id, status, access_method, checked_in_at")
        .order("checked_in_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });
  const members = useQuery({
    queryKey: ["members"],
    queryFn: async () => {
      const { data, error } = await createClient().from("profiles").select("id, full_name").eq("role", "member").order("full_name");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const video = videoRef.current;
    const DetectorCtor = (window as unknown as { BarcodeDetector?: new (options: { formats: string[] }) => Detector }).BarcodeDetector;
    if (!video || !DetectorCtor) return;
    let stop = false;
    let stream: MediaStream | null = null;
    const detector = new DetectorCtor({ formats: ["qr_code"] });
    void navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then(async (media) => {
      stream = media;
      video.srcObject = media;
      await video.play();
      const scan = async () => {
        if (stop) return;
        const codes = await detector.detect(video).catch(() => []);
        const value = codes[0]?.rawValue;
        if (value) setToken(value);
        else window.setTimeout(() => void scan(), 400);
      };
      void scan();
    }).catch(() => undefined);
    return () => {
      stop = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <section className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[360px_1fr]">
      <Card>
        <h1 className="text-3xl font-semibold">Acceso</h1>
        <video ref={videoRef} className="mt-4 aspect-square w-full rounded-xl bg-black object-cover" muted playsInline />
        <form action={action} className="mt-4 flex flex-col gap-3">
          <Field label="Token QR">
            <Input name="token" value={token} onChange={(event) => setToken(event.target.value)} />
          </Field>
          <Field label="O busca al cliente">
            <Select name="memberId" defaultValue="">
              <option value="">Seleccionar</option>
              {(members.data ?? []).map((member) => (
                <option key={member.id} value={member.id}>{member.full_name}</option>
              ))}
            </Select>
          </Field>
          <FormNote state={state} />
          <Button disabled={pending} type="submit">Validar entrada</Button>
        </form>
      </Card>
      <div>
        <h2 className="text-lg font-semibold">Últimos accesos</h2>
        <ul className="mt-3 space-y-2">
          {(logs.data ?? []).map((log) => (
            <li key={log.id} className="rounded-xl border border-border bg-card px-4 py-3 text-sm">
              {log.status} · {log.access_method} · {when(log.checked_in_at)}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
