"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { signOut } from "@/app/actions";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandLogo } from "@/components/ui";
import { supabaseConfigured } from "@/lib/supabase/browser";
import { useProfile } from "./use-profile";

const links = [
  { href: "/", label: "Tablero" },
  { href: "/members", label: "Clientes" },
  { href: "/plans", label: "Planes" },
  { href: "/promotions", label: "Promociones" },
  { href: "/news", label: "Noticias" },
  { href: "/payments", label: "Pagos" },
  { href: "/exercises", label: "Ejercicios" },
  { href: "/routines", label: "Rutinas" },
  { href: "/classes", label: "Clases" },
  { href: "/access", label: "Acceso" },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const profile = useProfile();
  if (pathname === "/login" || pathname === "/signup" || pathname.startsWith("/acceso/invitar")) return <>{children}</>;

  const role = profile.data?.role;
  const visible = links.filter((link) => {
    if (role === "trainer" && (link.href === "/plans" || link.href === "/promotions" || link.href === "/payments")) return false;
    return true;
  });

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-[240px_1fr]">
      <aside className="flex flex-col gap-6 border-r border-border bg-sidebar px-4 py-6 text-foreground">
        <div className="px-2">
          <BrandLogo className="h-auto w-full" />
          <p className="mt-3 text-sm text-muted-foreground">{profile.data?.full_name ?? "Recepción"}</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {visible.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-xl px-3 py-2 text-sm ${active ? "bg-primary font-medium text-primary-foreground" : "text-foreground/80 hover:bg-muted"}`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <ThemeToggle />
        <form action={signOut}>
          <button className="px-3 text-left text-sm text-muted-foreground" type="submit">
            Cerrar sesión
          </button>
        </form>
      </aside>
      <main className="px-5 py-8 md:px-10">{supabaseConfigured() ? children : <SetupNotice />}</main>
    </div>
  );
}

function SetupNotice() {
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-6">
      <h1 className="text-2xl font-semibold">Conecta Supabase</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Copia .env.example a apps/web/.env.local, pega la URL y la anon key, y reinicia el servidor.
      </p>
    </div>
  );
}
