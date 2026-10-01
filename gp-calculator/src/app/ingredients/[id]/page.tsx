"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { requireActor } from "@/lib/actor";
import { PriceHistory } from "@/components/PriceHistory";
import { ConfirmButton } from "@/components/ConfirmButton";
import { PageTitle } from "@/components/PageTitle";
import { ListSkeleton, LoadError } from "@/components/Skeleton";
import { IngredientForm, IngredientFormValues } from "@/components/IngredientForm";
import { setFlash } from "@/lib/flash";

export default function EditIngredientPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const fromParam = useSearchParams().get("from");
  // come back to where you were (e.g. the supplier list), not the unfiltered ingredient list
  const backHref = fromParam && fromParam.startsWith("/") ? fromParam : "/ingredients";
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [initialValues, setInitialValues] = useState<IngredientFormValues | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [priceEstimated, setPriceEstimated] = useState(false);
  const [archived, setArchived] = useState(false);
  const [cheaper, setCheaper] = useState<{ id: string; name: string; supplier: string; pctCheaper: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setLoadError(false);
    const okJson = (r: Response) => {
      if (!r.ok) throw new Error("bad response");
      return r.json();
    };
    fetch("/api/suppliers").then(okJson).then(setSuppliers).catch(() => setLoadError(true));
    fetch(`/api/ingredients/${id}`)
      .then(okJson)
      .then((i) => {
        setPriceEstimated(Boolean(i.priceEstimated));
        setArchived(Boolean(i.archived));
        setCheaper(i.cheaper ?? null);
        setInitialValues({
          name: i.name,
          category: i.category,
          supplierId: i.supplierId,
          purchaseUnit: i.purchaseUnit,
          packQuantity: Number(i.packQuantity),
          packPrice: Number(i.packPrice),
          yieldPct: Number(i.yieldPct),
          createdBy: "",
        });
        // The ingredient's current supplier may be archived, and archived
        // suppliers are excluded from GET /api/suppliers. Make sure it still
        // shows up as an option so the dropdown doesn't render blank/broken.
        if (i.supplier) {
          setSuppliers((prev) =>
            prev.some((s) => s.id === i.supplier.id)
              ? prev
              : [...prev, { id: i.supplier.id, name: i.supplier.archived ? `${i.supplier.name} (archived)` : i.supplier.name }]
          );
        }
      })
      .catch(() => setLoadError(true));
  }, [id, reloadKey]);

  async function handleSubmit(values: IngredientFormValues) {
    const res = await fetch(`/api/ingredients/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: values.name,
        category: values.category,
        supplierId: values.supplierId,
        purchaseUnit: values.purchaseUnit,
        packQuantity: values.packQuantity,
        packPrice: values.packPrice,
        yieldPct: values.yieldPct,
        ...(priceEstimated && values.confirmReal ? { priceEstimated: false } : {}),
        updatedBy: values.createdBy, // the "Your name" field on the edit form means "who's making this edit"
      }),
    });
    if (res.ok) {
      setFlash(`Saved ${values.name}.`);
      router.push(backHref);
    } else {
      const body = await res.json().catch(() => null);
      setError(typeof body?.error === "string" ? body.error : "Could not save changes. Please try again.");
    }
  }

  async function handleRestore() {
    const updatedBy = requireActor();
    if (!updatedBy) return;
    const res = await fetch(`/api/ingredients/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: false, updatedBy }),
    });
    if (res.ok) {
      setArchived(false);
      setNotice("Restored. It is back in the ingredient list.");
    } else {
      setError("Could not restore this ingredient. Please try again.");
    }
  }

  async function handleSwitch() {
    if (!cheaper) return;
    const updatedBy = requireActor();
    if (!updatedBy) return;
    const res = await fetch(`/api/ingredients/${id}/switch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toIngredientId: cheaper.id, updatedBy }),
    });
    const body = await res.json().catch(() => null);
    if (res.ok) {
      setCheaper(null);
      setNotice(`Switched ${body.dishesSwitched} dish${body.dishesSwitched === 1 ? "" : "es"} and ${body.batchesSwitched} batch recipe line${body.batchesSwitched === 1 ? "" : "s"} to ${cheaper.name}.`);
    } else {
      setError(typeof body?.error === "string" ? body.error : "Could not switch recipes. Please try again.");
    }
  }

  async function handleArchive() {
    const updatedBy = requireActor();
    if (!updatedBy) return;
    const res = await fetch(`/api/ingredients/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: true, updatedBy }),
    });
    if (res.ok) {
      setFlash("Ingredient archived. You can restore it from Show archived.");
      router.push(backHref);
    } else {
      setError("Could not archive this ingredient. Please try again.");
    }
  }

  if (!initialValues) {
    return (
      <main>
        {loadError ? (
          <LoadError what="this ingredient" onRetry={() => setReloadKey((k) => k + 1)} />
        ) : (
          <ListSkeleton label="Loading ingredient" rows={2} />
        )}
      </main>
    );
  }

  return (
    <main>
      <PageTitle title="Edit ingredient" />
      <h1>Edit ingredient</h1>
      <div>
        {error && (
          <p role="alert">
            {error}
          </p>
        )}
        {notice && <p>{notice}</p>}
        {archived && (
          <div>
            <p>This ingredient is archived</p>
            <p>It is hidden from the ingredient list and pickers.</p>
            <button type="button" onClick={handleRestore}>
              Restore
            </button>
          </div>
        )}
        {cheaper && !archived && (
          <div>
            <p>{cheaper.pctCheaper}% cheaper at {cheaper.supplier}</p>
            <p>
              {cheaper.name} costs less per unit. You can point every recipe that uses this ingredient at it.
            </p>
            <ConfirmButton
              label={`Switch recipes to ${cheaper.name}`}
              question={`Point every recipe that uses this at ${cheaper.name} (${cheaper.supplier})? Dishes using it get a new recosted version.`}
              confirmLabel="Switch recipes"
              onConfirm={handleSwitch}
            />
          </div>
        )}
        <IngredientForm
          suppliers={suppliers}
          initialValues={initialValues}
          priceEstimated={priceEstimated}
          cancelHref={backHref}
          onSubmit={handleSubmit}
        />
        {!archived && (
          <ConfirmButton
            label="Archive this ingredient"
            question="Archive this ingredient? It is hidden from lists and pickers, and you can restore it later."
            confirmLabel="Archive"
            onConfirm={handleArchive}
          />
        )}
      </div>
      <PriceHistory ingredientId={id} />
    </main>
  );
}
