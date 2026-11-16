"use client";

import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/ui";

function loginQuery(correo: string, clave: string) {
  return new URLSearchParams({ correo, clave }).toString();
}

function localHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".local") || /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(hostname);
}

function mobileWebLogin(correo: string, clave: string) {
  const query = loginQuery(correo, clave);
  const configured = process.env.NEXT_PUBLIC_MOBILE_URL?.replace(/\/$/, "");
  if (configured) return `${configured}/login?${query}`;
  if (localHost(window.location.hostname)) return `${window.location.protocol}//${window.location.hostname}:8081/login?${query}`;
  return `${window.location.origin}/movil/login?${query}`;
}

export function InviteCard({ nombre, correo, clave }: { nombre: string; correo: string; clave: string }) {
  const [appUrl, setAppUrl] = useState("");
  useEffect(() => {
    if (correo && clave) setAppUrl(mobileWebLogin(correo, clave));
  }, [clave, correo]);
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <section className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center">
        <BrandLogo className="mx-auto h-14 w-auto" />
        <h1 className="mt-4 text-2xl font-semibold">Tu acceso</h1>
        {correo && clave ? (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              {nombre ? `${nombre}, estas son tus credenciales.` : "Estas son tus credenciales."} El botón abre el inicio de sesión de la app.
            </p>
            <dl className="mt-5 space-y-3 text-left">
              <div className="rounded-xl bg-muted px-4 py-3">
                <dt className="text-xs text-muted-foreground">Correo</dt>
                <dd className="mt-1 break-all font-medium">{correo}</dd>
              </div>
              <div className="rounded-xl bg-muted px-4 py-3">
                <dt className="text-xs text-muted-foreground">Contraseña</dt>
                <dd className="mt-1 font-mono font-medium">{clave}</dd>
              </div>
            </dl>
            <a
              className="mt-6 inline-flex rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              href={appUrl || "#"}
              onClick={(event) => {
                if (!appUrl) {
                  event.preventDefault();
                  return;
                }
                const phone = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
                if (!phone) return;
                event.preventDefault();
                const web = event.currentTarget.href;
                window.location.href = `energym://login?${loginQuery(correo, clave)}`;
                window.setTimeout(() => {
                  if (document.visibilityState === "visible") window.location.assign(web);
                }, 1200);
              }}
            >
              Abrir la app
            </a>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Este enlace de acceso no es válido.</p>
        )}
      </section>
    </main>
  );
}
