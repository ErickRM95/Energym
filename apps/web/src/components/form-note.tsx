"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { ActionState } from "@/app/actions";

export function FormNote({ state }: { state: ActionState }) {
  const client = useQueryClient();
  useEffect(() => {
    if (state.ok) void client.invalidateQueries();
  }, [client, state]);

  if (state.error) return <p className="text-sm text-destructive">{state.error}</p>;
  if (!state.ok) return null;
  return (
    <p className="text-sm">
      {state.ok}
      {state.detail ? <span className="mt-1 block font-mono text-xs text-muted-foreground">{state.detail}</span> : null}
    </p>
  );
}
