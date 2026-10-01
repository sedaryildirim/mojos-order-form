"use client";

import { useState } from "react";
import { safeFetch, apiError } from "@/lib/client/api";

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
    const res = await safeFetch(`/api/dish-versions/${versionId}/photo`, { method: "POST", body: formData });
    setUploading(false);
    if (!res.ok) {
      setError(await apiError(res, "Could not upload photo. Please try again."));
      e.target.value = ""; // let the same file be chosen again after a failure
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
