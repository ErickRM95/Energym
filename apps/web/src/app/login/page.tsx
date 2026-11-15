"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, type ActionState } from "@/app/actions";
import { FormNote } from "@/components/form-note";
import { BrandLogo, Button, Card, Field, Input } from "@/components/ui";

export default function LoginPage() {
  const [state, action, pending] = useActionState<ActionState, FormData>(login, {});
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <Card className="w-full max-w-md">
        <BrandLogo className="h-16 w-auto" />
        <h1 className="mt-4 text-3xl font-semibold">Entrar a recepción</h1>
        <form action={action} className="mt-6 flex flex-col gap-4">
          <Field label="Correo">
            <Input name="email" type="email" autoComplete="email" required />
          </Field>
          <Field label="Contraseña">
            <Input name="password" type="password" autoComplete="current-password" required />
          </Field>
          <FormNote state={state} />
          <Button disabled={pending} type="submit">
            {pending ? "Entrando…" : "Entrar"}
          </Button>
        </form>
        <p className="mt-4 text-sm text-muted-foreground">
          ¿Vas a abrir un gimnasio? <Link href="/signup">Crear sede</Link>
        </p>
      </Card>
    </main>
  );
}
