"use client";

import { useId, useRef } from "react";
import { FileText, Paperclip, X } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { DocumentUpload, SupportingDocument } from "../types/approval";

export type PickedDocument = DocumentUpload | SupportingDocument;

const MAX_DOCUMENTS = 5;

export const formatBytes = (bytes: number) =>
  bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

// Picks supporting documents (images or PDFs). Files stay in the browser: each
// gets an object URL to open it, until a backend stores them.
export function DocumentPicker({ value, onChange, label = "Supporting documents" }: { value: PickedDocument[]; onChange: (documents: PickedDocument[]) => void; label?: string }) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={inputId} className="text-sm font-medium">
          {label}
        </label>
        <Button type="button" variant="outline" size="sm" disabled={value.length >= MAX_DOCUMENTS} onClick={() => inputRef.current?.click()}>
          <Paperclip data-icon="inline-start" />
          Attach
        </Button>
      </div>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        multiple
        accept="image/*,application/pdf"
        className="sr-only"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          onChange([...value, ...files.map((file) => ({ name: file.name, type: file.type, size: file.size, url: URL.createObjectURL(file) }))]);
          event.target.value = "";
        }}
      />
      {value.length === 0 ? (
        <p className="text-xs text-muted-foreground">Photos or PDFs, up to {MAX_DOCUMENTS} files, 10 MB each.</p>
      ) : (
        <ul aria-label="Attached documents" className="flex flex-col gap-1">
          {value.map((document, index) => (
            <li key={`${document.url}-${index}`} className="flex items-center gap-2 rounded-md border border-border px-2 py-1 text-sm">
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <a href={document.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate hover:underline hover:underline-offset-4">
                {document.name}
              </a>
              <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(document.size)}</span>
              <Button type="button" variant="ghost" size="icon" className="size-6" aria-label={`Remove ${document.name}`} onClick={() => onChange(value.filter((_, position) => position !== index))}>
                <X />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
