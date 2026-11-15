"use client";

import { Fragment, startTransition, useActionState, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteNews, saveNews, type ActionState } from "@/app/actions";
import { FormNote } from "@/components/form-note";
import { Badge, Button, Card, Field, Input, TextArea } from "@/components/ui";
import { when } from "@/lib/format";
import { uploadNewsImage } from "@/lib/news-image";
import { createClient } from "@/lib/supabase/browser";

function NewsImageField({ currentUrl }: { currentUrl?: string | null }) {
  const [preview, setPreview] = useState<string | null>(null);
  const shown = preview ?? currentUrl;
  return (
    <div className="grid gap-2">
      <Field label="Imagen">
        <Input
          name="image"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="h-auto py-2"
          onChange={(event) => {
            const file = event.target.files?.[0];
            setPreview(file ? URL.createObjectURL(file) : null);
          }}
        />
      </Field>
      <p className="text-xs text-muted-foreground">Opcional. JPG, PNG o WebP.</p>
      {shown ? <img src={shown} alt="" className="h-32 w-48 rounded-xl object-cover" /> : null}
      {currentUrl ? (
        <label className="flex items-center gap-2 text-sm">
          <input name="removeImage" type="checkbox" /> Quitar imagen
        </label>
      ) : null}
    </div>
  );
}

export default function NewsPage() {
  const queryClient = useQueryClient();
  const [state, action, pending] = useActionState<ActionState, FormData>(saveNews, {});
  const [editState, editAction, editPending] = useActionState<ActionState, FormData>(saveNews, {});
  const [deleteState, deleteAction, deletePending] = useActionState<ActionState, FormData>(deleteNews, {});
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [note, setNote] = useState<ActionState>({});
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const news = useQuery({
    queryKey: ["news"],
    queryFn: async () => {
      const { data, error } = await createClient().from("news_posts").select("*").order("published_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function withImage(formData: FormData) {
    setUploadError("");
    const file = formData.get("image");
    formData.delete("image");
    if (!(file instanceof File) || file.size === 0) return formData;
    try {
      formData.set("imageUrl", await uploadNewsImage(file));
      formData.delete("removeImage");
      return formData;
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "No se pudo subir la imagen.");
      return null;
    }
  }

  async function submitCreate(formData: FormData) {
    setUploading(true);
    const ready = await withImage(formData);
    setUploading(false);
    if (!ready) return;
    startTransition(() => action(ready));
  }

  async function submitEdit(formData: FormData) {
    setUploading(true);
    const ready = await withImage(formData);
    setUploading(false);
    if (!ready) return;
    startTransition(() => editAction(ready));
  }

  useEffect(() => {
    if (!state.ok && !state.error) return;
    setNote(state);
    if (!state.ok) {
      setOpen(true);
      return;
    }
    setOpen(false);
    void queryClient.invalidateQueries({ queryKey: ["news"] });
  }, [state, queryClient]);
  useEffect(() => {
    if (editState.ok || editState.error) setNote(editState);
    if (!editState.ok && !deleteState.ok) return;
    setEditingId(null);
    void queryClient.invalidateQueries({ queryKey: ["news"] });
  }, [editState, deleteState, queryClient]);

  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-6">
      <div>
        <h1 className="text-4xl font-semibold">Noticias</h1>
        <Card className="mt-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Agregar nueva noticia</h2>
            <Button type="button" variant="outline" onClick={() => setOpen((value) => !value)}>
              {open ? "Minimizar" : "Maximizar"}
            </Button>
          </div>
          {!open && (note.ok || note.error) ? <div className="mt-3"><FormNote state={note} /></div> : null}
          {open ? (
            <form action={submitCreate} className="mt-4 grid gap-3">
              <Field label="Título *"><Input name="title" required /></Field>
              <Field label="Noticia *"><TextArea name="body" required /></Field>
              <NewsImageField />
              <label className="flex items-center gap-2 text-sm">
                <input name="isPublished" type="checkbox" defaultChecked /> Publicada
              </label>
              <div>
                {uploadError ? <p className="text-sm text-destructive">{uploadError}</p> : null}
                <FormNote state={state} />
                <Button className="mt-3" disabled={pending || uploading} type="submit">{pending || uploading ? "Guardando…" : "Publicar noticia"}</Button>
              </div>
            </form>
          ) : null}
        </Card>
        <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Título</th>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {news.error ? (
                <tr>
                  <td className="px-4 py-3 text-destructive" colSpan={4}>{news.error.message}</td>
                </tr>
              ) : null}
              {(news.data ?? []).map((item) => (
                <Fragment key={item.id}>
                  <tr className="border-t border-border">
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        {item.image_url ? <img src={item.image_url} alt="" className="h-14 w-20 shrink-0 rounded-lg object-cover" /> : null}
                        <div>
                          <p className="font-medium">{item.title}</p>
                          <p className="mt-1 line-clamp-2 text-muted-foreground">{item.body}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">{when(item.published_at)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={item.is_published ? "good" : "bad"}>{item.is_published ? "Publicada" : "Borrador"}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setEditingId((current) => current === item.id ? null : item.id)}>
                          {editingId === item.id ? "Cerrar" : "Editar"}
                        </Button>
                        <form
                          action={deleteAction}
                          onSubmit={(event) => {
                            if (!window.confirm("¿Eliminar esta noticia?")) event.preventDefault();
                          }}
                        >
                          <input name="newsId" type="hidden" value={item.id} />
                          <Button variant="danger" disabled={deletePending} type="submit">Eliminar</Button>
                        </form>
                      </div>
                    </td>
                  </tr>
                  {editingId === item.id ? (
                    <tr className="border-t border-border bg-muted/50">
                      <td className="px-4 py-4" colSpan={4}>
                        <form key={item.id} action={submitEdit} className="grid gap-3">
                          <input name="newsId" type="hidden" value={item.id} />
                          <Field label="Título *"><Input name="title" defaultValue={item.title} required /></Field>
                          <Field label="Noticia *"><TextArea name="body" defaultValue={item.body} required /></Field>
                          <NewsImageField currentUrl={item.image_url} />
                          <label className="flex items-center gap-2 text-sm">
                            <input name="isPublished" type="checkbox" defaultChecked={item.is_published} /> Publicada
                          </label>
                          <div>
                            {uploadError ? <p className="text-sm text-destructive">{uploadError}</p> : null}
                            <FormNote state={editState} />
                            <Button className="mt-3" disabled={editPending || uploading} type="submit">{editPending || uploading ? "Guardando…" : "Guardar cambios"}</Button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {deleteState.error || deleteState.ok ? <div className="mt-3"><FormNote state={deleteState} /></div> : null}
      </div>
    </section>
  );
}
