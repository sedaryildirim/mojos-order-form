"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { safeFetch, apiError } from "@/lib/client/api";
import { LIMITS } from "@/lib/db/validation";
import { ACTOR } from "@/lib/client/actor";

export default function NewDishPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const createdBy = ACTOR;
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleCreate() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await safeFetch("/api/dishes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, category, createdBy }),
    });
    const dish = await res.json().catch(() => null);
    if (!res.ok || !dish?.id) {
      setError(await apiError(res, "Could not create the dish. Enter a name and a category, then try again."));
      setBusy(false);
      return;
    }
    router.push(`/dishes/${dish.id}/versions/new`);
  }

  return (
    <main>
      <h1>New dish</h1>
      <div>
        <div>
          <label htmlFor="name">Dish name</label>
          <input id="name" maxLength={LIMITS.name} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label htmlFor="category">Category</label>
          <input id="category" maxLength={LIMITS.category} value={category} onChange={(e) => setCategory(e.target.value)} />
        </div>
        {error && <p role="alert">{error}</p>}
        <button type="button" onClick={handleCreate} disabled={busy}>
          {busy ? "Creating…" : "Continue to recipe"}
        </button>
      </div>
    </main>
  );
}
