"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signup, type ActionState } from "@/app/actions";
import { FormNote } from "@/components/form-note";
import { BrandLogo, Button, Card, Field, Input } from "@/components/ui";

export default function SignupPage() {
  const [state, action, pending] = useActionState<ActionState, FormData>(signup, {});
  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <Card className="w-full max-w-md">
        <BrandLogo className="mb-5 h-16 w-auto" />
        <h1 className="text-3xl font-semibold">Abrir un gimnasio</h1>
        <form action={action} className="mt-6 flex flex-col gap-4">
          <Field label="Tu nombre">
            <Input name="fullName" required />
          </Field>
          <Field label="Correo">
            <Input name="email" type="email" required />
          </Field>
          <Field label="Contraseña">
            <Input name="password" type="password" required />
          </Field>
          <Field label="Nombre del gimnasio">
            <Input name="organizationName" required />
          </Field>
          <Field label="Identificador">
            <Input name="organizationSlug" placeholder="energym-centro" required />
          </Field>
          <FormNote state={state} />
          <Button disabled={pending} type="submit">
            {pending ? "Creando…" : "Crear sede"}
          </Button>
        </form>
        <p className="mt-4 text-sm">
          <Link href="/login">Ya tengo cuenta</Link>
        </p>
      </Card>
    </main>
  );
}
