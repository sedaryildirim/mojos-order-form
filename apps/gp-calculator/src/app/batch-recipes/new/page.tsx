"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BatchRecipeForm, BatchRecipePayload } from "@/components/batch/BatchRecipeForm";
import { setFlash } from "@/lib/client/flash";
import { safeFetch } from "@/lib/client/api";

export default function NewBatchRecipePage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/suppliers").then((r) => r.json()).then(setSuppliers);
    fetch("/api/ingredients").then((r) => r.json()).then((all: { category: string }[]) => {
      setCategories(Array.from(new Set(all.map((i) => i.category))).sort());
    });
  }, []);

  async function handleSubmit(payload: BatchRecipePayload) {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    const res = await safeFetch("/api/batch-recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setFlash(`Created ${payload.name}.`);
      router.push("/batch-recipes");
      return;
    }
    const body = await res.json().catch(() => null);
    setError(typeof body?.error === "string" ? body.error : "Could not save this batch recipe.");
    setSubmitting(false);
  }

  return (
    <main>
      <h1>New batch recipe</h1>
      {error && <p role="alert">{error}</p>}
      <div>
        <BatchRecipeForm suppliers={suppliers} categories={categories} onSubmit={handleSubmit} submitting={submitting} />
      </div>
    </main>
  );
}
