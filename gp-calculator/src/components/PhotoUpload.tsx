"use client";

import { useState } from "react";

export function PhotoUpload({ versionId }: { versionId: string }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`/api/dish-versions/${versionId}/photo`, { method: "POST", body: formData });
    setUploading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Could not upload photo. Please try again.");
      return;
    }
    window.location.reload();
  }

  return (
    <div>
      <label htmlFor="photo">Plated dish photo</label>
      <input id="photo" type="file" accept="image/*" onChange={handleChange} disabled={uploading} />
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
