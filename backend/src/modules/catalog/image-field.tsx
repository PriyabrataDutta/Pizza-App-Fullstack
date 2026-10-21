"use client";

import { useId, useRef, useState } from "react";
import { ImageIcon, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/shared/ui";
import { ACCEPTED_IMAGE_TYPES, ApiError, MAX_IMAGE_BYTES, imageProblem, uploadImage } from "./admin-client";

export interface PickedImage {
  path: string;
  url: string | null;
}

/**
 * Photo picker for a category or product. The file goes straight to storage; this only hands back the path to save.
 * `url` is what to show now (the saved image, or the one just uploaded). Used by the category form and, later, the product editor.
 */
export function ImageField({ kind, label, url, onChange, disabled }: {
  kind: "product" | "category";
  label: string;
  url: string | null;
  onChange: (next: PickedImage | null) => void;
  disabled?: boolean;
}) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function pick(file: File | undefined) {
    if (!file) return;
    setError("");
    const problem = imageProblem(file);
    if (problem) return setError(problem);
    setBusy(true);
    try {
      onChange(await uploadImage(kind, file));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "The image could not be uploaded. Try again.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span id={`${inputId}-label`} className="text-[13px] font-medium">{label}</span>
      <div className="flex items-center gap-3">
        <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-control border border-line bg-subtle text-ink-2">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element -- a public storage URL; no need for the image optimizer
            <img src={url} alt="" className="size-full object-cover" />
          ) : (
            <ImageIcon className="size-7" aria-hidden />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={input}
            id={inputId}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES.join(",")}
            className="sr-only"
            disabled={disabled || busy}
            aria-labelledby={`${inputId}-label`}
            onChange={(e) => void pick(e.target.files?.[0])}
          />
          <Button type="button" variant="secondary" size="sm" disabled={disabled || busy} onClick={() => input.current?.click()}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />}
            {busy ? "Uploading…" : url ? "Replace" : "Upload"}
          </Button>
          {url && !busy && (
            <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => onChange(null)}>
              <X className="size-4" aria-hidden /> Remove
            </Button>
          )}
        </div>
      </div>
      {error ? <p role="alert" className="text-xs text-error">{error}</p> : <p className="text-xs text-ink-2">JPG, PNG or WebP, up to {MAX_IMAGE_BYTES / 1024 / 1024} MB.</p>}
    </div>
  );
}
