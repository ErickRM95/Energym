"use client";

import { useEffect, useState } from "react";
import { InviteCard } from "@/components/invite-card";

export default function InvitePage() {
  const [ready, setReady] = useState(false);
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    setNombre(params.get("nombre") ?? "");
    setCorreo(params.get("correo") ?? "");
    setClave(params.get("clave") ?? "");
    setReady(true);
  }, []);

  if (!ready) return null;
  return <InviteCard nombre={nombre} correo={correo} clave={clave} />;
}
