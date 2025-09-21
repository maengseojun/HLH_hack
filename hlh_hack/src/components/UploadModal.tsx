"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (file: File) => void;
};

export default function UploadModal({ open, onClose, onConfirm }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Dialog */}
      <div className="relative w-full max-w-md mx-4 rounded-[16px] border border-[color:var(--color-border)] bg-[color:var(--color-card)]/80 backdrop-blur-md p-4">
        <div className="text-white font-semibold mb-3">Upload Index Image</div>

        <div className="space-y-3">
          <div className="relative">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              id="upload-input"
            />
            <label
              htmlFor="upload-input"
              className="flex items-center justify-center w-full rounded-[12px] bg-[color:var(--color-input-background)] border border-[color:var(--color-border)] px-3 py-2 text-white cursor-pointer hover:bg-[color:var(--color-muted)] transition-colors"
            >
              <span className="text-center">
                {file ? file.name : "Choose file or drag and drop"}
              </span>
            </label>
          </div>

          {previewUrl && (
            <div className="rounded-[12px] overflow-hidden border border-[color:var(--color-border)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="Preview" className="w-full h-48 object-cover" />
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <button
              onClick={onClose}
              className="rounded-[12px] border border-[color:var(--color-secondary)] px-3 py-1.5 text-[color:var(--color-secondary)] hover:bg-[color:var(--color-secondary)] hover:text-[color:var(--color-background)]"
            >
              Cancel
            </button>
            <button
              onClick={() => file && onConfirm(file)}
              disabled={!file}
              className="rounded-[12px] bg-[color:var(--color-primary)] text-[color:var(--color-primary-foreground)] px-4 py-1.5 disabled:opacity-50"
            >
              Upload
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

