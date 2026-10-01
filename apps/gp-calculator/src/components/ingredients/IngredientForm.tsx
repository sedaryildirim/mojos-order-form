"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ingredientInputSchema, LIMITS } from "@/lib/db/validation";
import { isPlaceholderSupplier } from "@/lib/costing/estimates-shared";
import { FieldError } from "@/components/ui/FieldError";
import { ACTOR } from "@/lib/client/actor";

export interface IngredientFormValues {
  name: string;
  category: string;
  supplierId: string;
  purchaseUnit: "G" | "ML" | "EACH";
  packQuantity: number;
  packPrice: number;
  yieldPct: number;
  createdBy: string;
  // set on the edit form when the user confirms an estimated price is now the real one
  confirmReal?: boolean;
}

const emptyValues: IngredientFormValues = {
  name: "",
  category: "",
  supplierId: "",
  purchaseUnit: "G",
  packQuantity: 0,
  packPrice: 0,
  yieldPct: 100,
  createdBy: ACTOR,
};

export function IngredientForm({
  suppliers,
  initialValues,
  priceEstimated = false,
  cancelHref = "/ingredients",
  onSubmit,
}: {
  suppliers: { id: string; name: string }[];
  initialValues?: IngredientFormValues;
  priceEstimated?: boolean;
  cancelHref?: string;
  onSubmit: (values: IngredientFormValues) => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  useEffect(() => {
    fetch("/api/ingredients")
      .then((r) => r.json())
      .then((all: { category: string }[]) => setCategories(Array.from(new Set(all.map((i) => i.category))).sort()))
      .catch(() => {});
  }, []);
  const [values, setValues] = useState<IngredientFormValues>(initialValues ?? emptyValues);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function set<K extends keyof IngredientFormValues>(key: K, value: IngredientFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = ingredientInputSchema.safeParse(values);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) fieldErrors[issue.path[0] as string] = issue.message;
      setErrors(fieldErrors);
      return;
    }
    const chosen = suppliers.find((s) => s.id === values.supplierId);
    if (values.confirmReal && chosen && isPlaceholderSupplier(chosen.name)) {
      setErrors({ supplierId: "Choose the supplier you actually buy this from before confirming the price." });
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await onSubmit(values);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="name">Ingredient name</label>
        <input
          id="name" maxLength={LIMITS.name}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? "name-error" : undefined}
          value={values.name}
          onChange={(e) => set("name", e.target.value)}
        />
        <FieldError id="name-error" message={errors.name} />
      </div>
      <div data-row>
<div>
        <label htmlFor="category">Category</label>
        <input
          id="category" maxLength={LIMITS.category}
          aria-invalid={errors.category ? true : undefined}
          aria-describedby={errors.category ? "category-error" : undefined}
          list="ingredient-categories"
          value={values.category}
          onChange={(e) => set("category", e.target.value)}
        />
        <datalist id="ingredient-categories">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <FieldError id="category-error" message={errors.category} />
      </div>
      <div>
        <label htmlFor="supplierId">Supplier</label>
        <select
          id="supplierId"
          aria-invalid={errors.supplierId ? true : undefined}
          aria-describedby={errors.supplierId ? "supplierId-error" : undefined}
          value={values.supplierId}
          onChange={(e) => set("supplierId", e.target.value)}
        >
          <option value="">Select a supplier</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <FieldError id="supplierId-error" message={errors.supplierId} />
      </div>
      </div>
<div data-row>
<div>
        <label htmlFor="purchaseUnit">Purchase unit</label>
        <select
          id="purchaseUnit"
          value={values.purchaseUnit}
          onChange={(e) => set("purchaseUnit", e.target.value as IngredientFormValues["purchaseUnit"])}
        >
          <option value="G">Weight (grams/kg)</option>
          <option value="ML">Volume (ml/litres)</option>
          <option value="EACH">Count (each)</option>
        </select>
      </div>
      <div>
        <label htmlFor="packQuantity">Pack quantity</label>
        <input
          id="packQuantity"
          aria-invalid={errors.packQuantity ? true : undefined}
          type="number"
          min="0"
          step="any"
          value={values.packQuantity || ""}
          aria-describedby={errors.packQuantity ? "packQuantity-hint packQuantity-error" : "packQuantity-hint"}
          onChange={(e) => set("packQuantity", Number(e.target.value))}
        />
        <p id="packQuantity-hint">
          How much is in one pack, in {values.purchaseUnit === "G" ? "grams (a 5 kg bag is 5000)" : values.purchaseUnit === "ML" ? "millilitres (a 1 l bottle is 1000)" : "pieces"}.
        </p>
        <FieldError id="packQuantity-error" message={errors.packQuantity} />
      </div>
      <div>
        <label htmlFor="packPrice">Pack price (฿)</label>
        <input
          id="packPrice"
          aria-invalid={errors.packPrice ? true : undefined}
          type="number"
          min="0"
          step="any"
          value={values.packPrice || ""}
          aria-describedby={errors.packPrice ? "packPrice-hint packPrice-error" : "packPrice-hint"}
          onChange={(e) => set("packPrice", Number(e.target.value))}
        />
        <p id="packPrice-hint">
          The price of the whole pack in baht, as you pay the supplier.
        </p>
        <FieldError id="packPrice-error" message={errors.packPrice} />
      </div>
      <div>
        <label htmlFor="yieldPct">Yield %</label>
        <input
          id="yieldPct"
          aria-invalid={errors.yieldPct ? true : undefined}
          aria-describedby={errors.yieldPct ? "yieldPct-error" : undefined}
          type="number"
          min="0"
          step="any"
          value={values.yieldPct}
          onChange={(e) => set("yieldPct", Number(e.target.value))}
        />
        <p>
          The share you can actually use after peeling or trimming. Leave at 100 if there is no waste.
        </p>
        <FieldError id="yieldPct-error" message={errors.yieldPct} />
      </div>
</div>
      {priceEstimated && (
        <div>
          <p>This price is an estimate</p>
          <p>
            Enter the real supplier, pack size and price above, then tick the box to confirm. Until then, dishes and
            batches that use it stay flagged.
          </p>
          <label>
            <input
              type="checkbox"
              checked={values.confirmReal ?? false}
              onChange={(e) => set("confirmReal", e.target.checked)}
            />
            <span>This is the real price (from an invoice, receipt or quote)</span>
          </label>
        </div>
      )}
      <div>
        <button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save ingredient"}
        </button>
        <Link href={cancelHref}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
