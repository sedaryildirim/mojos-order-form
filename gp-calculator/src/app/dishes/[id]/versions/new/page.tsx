"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { DishVersionForm, DishVersionPayload } from "@/components/DishVersionForm";
import type { Line } from "@/components/DishVersionForm";
import { setFlash } from "@/lib/flash";
import { PageTitle } from "@/components/PageTitle";
import { ListSkeleton } from "@/components/Skeleton";

export default function NewDishVersionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const amendFrom = useSearchParams().get("amendFrom"); // a version id to duplicate

  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [initialLines, setInitialLines] = useState<Line[] | undefined>(undefined);
  const [initialSellingPrice, setInitialSellingPrice] = useState<number | undefined>(undefined);
  const [initialTargetGpPct, setInitialTargetGpPct] = useState<number | undefined>(undefined);
  const [initialNotes, setInitialNotes] = useState<string | undefined>(undefined);
  const [ready, setReady] = useState(!amendFrom);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/suppliers").then((r) => r.json()).then(setSuppliers);
    fetch("/api/ingredients").then((r) => r.json()).then((ingredients) => {
      setCategories(Array.from(new Set(ingredients.map((i: { category: string }) => i.category))));
    });
  }, []);

  useEffect(() => {
    if (!amendFrom) return;
    fetch(`/api/dish-versions/${amendFrom}`)
      .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
      .then(async ({ ok, data: version }) => {
        if (!ok || !version?.lines) {
          throw new Error("Previous version could not be loaded");
        }
        // Fetch each ingredient's CURRENT pricing (not the old snapshot) so the
        // amend form's live cost/GP preview reflects today's prices. The previous
        // version's own stored costSnapshot is untouched by this — it's a display
        // choice for the new draft only.
        const linesWithCurrentPricing = await Promise.all(
          version.lines.map(async (l: { ingredientId: string; ingredientNameSnapshot: string; quantity: string; unit: string }) => {
            const ingredient = await fetch(`/api/ingredients/${l.ingredientId}`).then((r) => r.json());
            return {
              ingredientId: l.ingredientId,
              name: l.ingredientNameSnapshot,
              quantity: Number(l.quantity),
              unit: l.unit,
              pricing: {
                purchaseUnit: ingredient.purchaseUnit,
                packQuantity: Number(ingredient.packQuantity),
                packPrice: Number(ingredient.packPrice),
                yieldPct: Number(ingredient.yieldPct),
              },
            };
          })
        );
        setInitialLines(linesWithCurrentPricing);
        setInitialSellingPrice(version.sellingPrice != null ? Number(version.sellingPrice) : undefined);
        setInitialTargetGpPct(version.targetGpPct != null ? Number(version.targetGpPct) : undefined);
        setInitialNotes(version.notes != null ? version.notes : undefined);
        setReady(true);
      })
      .catch(() => {
        setLoadError("Could not load the previous version.");
      });
  }, [amendFrom]);

  async function handleSubmit(payload: DishVersionPayload) {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/dishes/${id}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setFlash("New version saved.");
        router.push(`/dishes/${id}`);
        return;
      }
      let message = "Could not save this version. Please try again.";
      try {
        const body = await res.json();
        if (typeof body?.error === "string") {
          message = body.error;
        } else if (body?.error) {
          message = JSON.stringify(body.error);
        }
      } catch {
        // response body wasn't JSON — fall back to the generic message
      }
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <main>
        <p role="alert">{loadError}</p>
        <Link href={`/dishes/${id}`}>Back to dish</Link>
      </main>
    );
  }

  if (!ready)
    return (
      <main>
        <ListSkeleton label="Loading the previous version" rows={2} />
      </main>
    );

  return (
    <main>
      <PageTitle title={amendFrom ? "Amend dish" : "Build recipe"} />
      <h1>{amendFrom ? "Amend dish" : "Build recipe"}</h1>
      {submitError && <p role="alert">{submitError}</p>}
      <div>
        <DishVersionForm
          suppliers={suppliers}
          categories={categories}
          initialLines={initialLines}
          initialSellingPrice={initialSellingPrice}
          initialTargetGpPct={initialTargetGpPct}
          initialNotes={initialNotes}
          onSubmit={handleSubmit}
          submitting={submitting}
        />
      </div>
    </main>
  );
}
