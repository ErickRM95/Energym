"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { AppAccessShare } from "@/app/actions";
import { Button } from "@/components/ui";

export function accessLink(origin: string, share: AppAccessShare) {
  return `${origin}/i/${share.code}`;
}

export function ShareAccess({ share }: { share: AppAccessShare }) {
  const [url, setUrl] = useState("");
  const [image, setImage] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    const link = accessLink(window.location.origin, share);
    setUrl(link);
    void QRCode.toDataURL(link, { margin: 1, width: 320 }).then(setImage);
  }, [share]);

  async function copyLink() {
    await navigator.clipboard.writeText(url);
    setNote("Enlace copiado.");
  }

  async function copyQr() {
    if (!image) return;
    const blob = await (await fetch(image)).blob();
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    setNote("QR copiado.");
  }

  return (
    <div className="mt-4 rounded-2xl border border-border bg-background p-4">
      <h3 className="font-semibold">Compartir acceso a la app</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Copia el enlace o el QR y envíaselo a {share.name}. Al abrirlo entra al inicio de sesión de la app.
      </p>
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
        {image ? <img src={image} alt="QR para compartir el acceso" className="h-40 w-40 rounded-xl bg-white p-2" /> : null}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="break-all font-mono text-xs">{url}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void copyLink()}>Copiar enlace</Button>
            <Button type="button" variant="outline" disabled={!image} onClick={() => void copyQr()}>Copiar QR</Button>
          </div>
          {note ? <p className="text-sm">{note}</p> : null}
        </div>
      </div>
    </div>
  );
}
