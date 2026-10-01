"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { BatchRecipeForm, BatchRecipePayload } from "@/components/batch/BatchRecipeForm";
import { BatchScaler } from "@/components/batch/BatchScaler";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { PageTitle } from "@/components/layout/PageTitle";
import { ListSkeleton, LoadError } from "@/components/layout/Skeleton";
import { batchPortions } from "@/lib/costing/batch-math";
import { setFlash } from "@/lib/client/flash";
import { safeFetch, apiError } from "@/lib/client/api";

interface LoadedBatch {
  name: string;
  category: string;
  yieldQuantity: string;
  yieldUnit: "EACH" | "G" | "ML";
  portionSize: string | null;
  sellingPrice: string | null;
  notes: string | null;
  outputIngredientId: string | null;
  lines: {
    ingredientId: string;
    estimateNote: string | null;
    quantity: string;
    unit: "G" | "KG" | "ML" | "L" | "EACH";
    ingredient: { name: string; purchaseUnit: "G" | "ML" | "EACH"; packQuantity: string; packPrice: string; yieldPct: string };
  }[];
}

export default function EditBatchRecipePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [batch, setBatch] = useState<LoadedBatch | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [overrides, setOverrides] = useState<Record<string, string | null>>({});

  useEffect(() => {
    setLoadError(false);
    const okJson = (r: Response) => {
      if (!r.ok) throw new Error("bad response");
      return r.json();
    };
    fetch("/api/suppliers").then(okJson).then(setSuppliers).catch(() => setLoadError(true));
    fetch("/api/ingredients")
      .then(okJson)
      .then((all: { category: string }[]) => setCategories(Array.from(new Set(all.map((i) => i.category))).sort()))
      .catch(() => setLoadError(true));
    fetch(`/api/batch-recipes/${id}`)
      .then(async (r) => {
        if (r.status === 404) return setNotFound(true);
        if (!r.ok) throw new Error("bad response");
        setBatch(await r.json());
      })
      .catch(() => setLoadError(true));
  }, [id, reloadKey]);

  // When you come back from fixing a price in another tab, refresh only the red flags, never your edits.
  useEffect(() => {
    function refreshFlags() {
      fetch(`/api/batch-recipes/${id}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((fresh: LoadedBatch | null) => {
          if (!fresh) return;
          setOverrides(Object.fromEntries(fresh.lines.map((l) => [l.ingredientId, l.estimateNote])));
        })
        .catch(() => {});
    }
    window.addEventListener("focus", refreshFlags);
    return () => window.removeEventListener("focus", refreshFlags);
  }, [id]);

  async function handleSubmit(payload: BatchRecipePayload) {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    const res = await safeFetch(`/api/batch-recipes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setFlash(`Saved ${payload.name}. Dishes that use it were recosted.`);
      router.push("/batch-recipes");
      return;
    }
    const body = await res.json().catch(() => null);
    setError(typeof body?.error === "string" ? body.error : "Could not save changes. Try again.");
    setSubmitting(false);
  }

  async function handleDelete() {
    const res = await safeFetch(`/api/batch-recipes/${id}`, { method: "DELETE" });
    if (res.ok) {
      setFlash("Batch recipe deleted.");
      router.push("/batch-recipes");
    } else setError(await apiError(res, "Could not delete this batch recipe. Try again."));
  }

  if (notFound) return <main>Batch recipe not found.</main>;
  if (loadError && !batch)
    return (
      <main>
        <LoadError what="this batch recipe" onRetry={() => setReloadKey((k) => k + 1)} />
      </main>
    );
  if (!batch)
    return (
      <main>
        <ListSkeleton label="Loading batch recipe" rows={2} />
      </main>
    );
  const flagged = batch.lines.filter((l) => (l.ingredientId in overrides ? overrides[l.ingredientId] : l.estimateNote));

  return (
    <main>
      <PageTitle title={batch.name} />
      <h1>{batch.name}</h1>
      <p>
        Saving updates this batch&apos;s cost. Any dish using it gets a new &quot;Cost updated&quot; version with the new cost.
      </p>
      {error && (
        <p role="alert">
          {error}
        </p>
      )}
      {flagged.length > 0 && (
        <div role="alert">
          <p>Has guessed prices</p>
          <p>
            {flagged.length} ingredient{flagged.length === 1 ? "" : "s"} below {flagged.length === 1 ? "uses" : "use"} an
            guessed price and {flagged.length === 1 ? "is" : "are"} tagged &quot;Price is a guess&quot;. Click a name to set its real
            supplier and price. It opens in a new tab, and the tag clears here when you come back to this tab.
            Your edits on this page are kept.
          </p>
        </div>
      )}
      <BatchScaler
        lines={batch.lines.map((l) => ({ name: l.ingredient.name, quantity: Number(l.quantity), unit: l.unit }))}
        portions={batchPortions(Number(batch.yieldQuantity), batch.yieldUnit, batch.portionSize === null ? null : Number(batch.portionSize))}
      />
      <div>
        <BatchRecipeForm
          suppliers={suppliers}
          categories={categories}
          lockYieldUnit={false}
          estimateOverrides={overrides}
          initial={{
            name: batch.name,
            category: batch.category,
            yieldQuantity: Number(batch.yieldQuantity),
            yieldUnit: batch.yieldUnit,
            portionSize: batch.portionSize === null ? null : Number(batch.portionSize),
            sellingPrice: batch.sellingPrice === null ? null : Number(batch.sellingPrice),
            notes: batch.notes ?? undefined,
            lines: batch.lines.map((l) => ({
              ingredientId: l.ingredientId,
              name: l.ingredient.name,
              estimateNote: l.estimateNote,
              quantity: Number(l.quantity),
              unit: l.unit,
              pricing: {
                purchaseUnit: l.ingredient.purchaseUnit,
                packQuantity: Number(l.ingredient.packQuantity),
                packPrice: Number(l.ingredient.packPrice),
                yieldPct: Number(l.ingredient.yieldPct),
              },
            })),
          }}
          onSubmit={handleSubmit}
          submitting={submitting}
        />
        <ConfirmButton
          label="Delete this batch recipe"
          question="Delete this batch recipe? The ingredient it published stays, so dishes keep working."
          confirmLabel="Delete"
          onConfirm={handleDelete}
        />
      </div>
    </main>
  );
}
