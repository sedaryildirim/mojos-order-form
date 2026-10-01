"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { IngredientPicker, PickableIngredient } from "@/components/ingredients/IngredientPicker";
import { dishVersionCost, RecipeLine } from "@/lib/costing/costing";
import { batchPortions } from "@/lib/costing/batch-math";
import { Unit, unitFamily } from "@/lib/costing/units";
import { formatTHB } from "@/lib/costing/currency";
import { LIMITS } from "@/lib/db/validation";
import { ACTOR } from "@/lib/client/actor";

const ALL_UNITS: Unit[] = ["G", "KG", "ML", "L", "EACH"];

export const YIELD_UNIT_LABELS: Record<"EACH" | "G" | "ML", string> = {
  EACH: "portions (each)",
  G: "grams",
  ML: "millilitres",
};

interface Line {
  ingredientId: string;
  name: string;
  estimateNote?: string | null;
  quantity: number;
  // exactly what was typed, so a leading zero or decimal point does not fight the box
  qtyText?: string;
  unit: Unit;
  pricing: { purchaseUnit: Unit; packQuantity: number; packPrice: number; yieldPct: number };
}

export interface BatchRecipePayload {
  name: string;
  category: string;
  yieldQuantity: number;
  yieldUnit: "EACH" | "G" | "ML";
  portionSize?: number | null;
  sellingPrice?: number | null;
  notes?: string;
  createdBy: string;
  lines: { ingredientId: string; quantity: number; unit: Unit }[];
}

export function BatchRecipeForm({
  suppliers,
  categories,
  initial,
  onSubmit,
  submitting,
  lockYieldUnit,
  estimateOverrides,
}: {
  suppliers: { id: string; name: string }[];
  categories: string[];
  initial?: {
    name: string;
    category: string;
    yieldQuantity: number;
    yieldUnit: "EACH" | "G" | "ML";
    portionSize?: number | null;
    sellingPrice?: number | null;
    notes?: string;
    lines: Line[];
  };
  onSubmit: (payload: BatchRecipePayload) => void;
  submitting?: boolean;
  lockYieldUnit?: boolean;
  // fresher estimate flags than the ones the lines were loaded with (ingredientId -> note or null)
  estimateOverrides?: Record<string, string | null>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState(initial?.category ?? "Bakery");
  const [yieldQuantity, setYieldQuantity] = useState<number | undefined>(initial?.yieldQuantity);
  const [yieldUnit, setYieldUnit] = useState<"EACH" | "G" | "ML">(initial?.yieldUnit ?? "EACH");
  const [portionSize, setPortionSize] = useState<number | undefined>(initial?.portionSize ?? undefined);
  const [sellingPrice, setSellingPrice] = useState<number | undefined>(initial?.sellingPrice ?? undefined);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [lines, setLines] = useState<Line[]>(initial?.lines ?? []);
  const createdBy = ACTOR;

  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const focusIndex = useRef<number | null>(null);

  // after adding an ingredient, move to its quantity box so typing can continue
  useEffect(() => {
    if (focusIndex.current !== null) {
      document.getElementById(`bqty-${focusIndex.current}`)?.focus();
      focusIndex.current = null;
    }
  }, [lines]);

  function addIngredient(ingredient: PickableIngredient) {
    setFormError(null);
    const existing = lines.findIndex((l) => l.ingredientId === ingredient.id);
    if (existing >= 0) {
      setNotice(`${ingredient.name} is already in this batch. Change its quantity instead.`);
      document.getElementById(`bqty-${existing}`)?.focus();
      return;
    }
    setNotice(null);
    focusIndex.current = lines.length;
    setLines((prev) => [
      ...prev,
      {
        ingredientId: ingredient.id,
        name: ingredient.name,
        quantity: 0,
        unit: ingredient.purchaseUnit,
        pricing: {
          purchaseUnit: ingredient.purchaseUnit,
          packQuantity: Number(ingredient.packQuantity),
          packPrice: Number(ingredient.packPrice),
          yieldPct: Number(ingredient.yieldPct),
        },
      },
    ]);
  }

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  const { cost, costError } = useMemo(() => {
    const recipeLines: RecipeLine[] = lines
      .filter((l) => l.quantity > 0)
      .map((l) => ({ pricing: l.pricing, quantity: l.quantity, unit: l.unit }));
    try {
      return { cost: dishVersionCost(recipeLines), costError: false };
    } catch {
      return { cost: 0, costError: true };
    }
  }, [lines]);

  const perUnit =
    !costError && yieldQuantity && yieldQuantity > 0
      ? cost / (yieldUnit === "EACH" ? yieldQuantity : yieldQuantity / 100)
      : null;
  const portions = yieldQuantity ? batchPortions(yieldQuantity, yieldUnit, portionSize ?? null) : null;
  const perPortion = !costError && portions && portions > 0 ? cost / portions : null;
  const perUnitLabel = yieldUnit === "EACH" ? "per portion" : yieldUnit === "G" ? "per 100 g" : "per 100 ml";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!yieldQuantity) return;
    const missing = lines.find((l) => !(l.quantity > 0));
    if (missing) {
      setFormError(`Enter a quantity for ${missing.name}, or remove it.`);
      return;
    }
    setFormError(null);
    onSubmit({
      name,
      category,
      yieldQuantity,
      yieldUnit,
      portionSize: portionSize ?? null,
      sellingPrice: sellingPrice ?? null,
      notes: notes || undefined,
      createdBy,
      lines: lines.filter((l) => l.quantity > 0).map((l) => ({ ingredientId: l.ingredientId, quantity: l.quantity, unit: l.unit })),
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <section data-row>
        <div>
          <label htmlFor="name">Batch name</label>
          <input id="name" maxLength={LIMITS.name} required value={name} onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Banana Bread" />
        </div>
        <div>
          <label htmlFor="category">Category</label>
          <input id="category" maxLength={LIMITS.category} required list="batch-categories" value={category}
            onChange={(e) => setCategory(e.target.value)} />
          <datalist id="batch-categories">
            {Array.from(new Set(["Bakery", "Bread", "Sauces & Prep", ...categories])).map((c) => <option key={c} value={c} />)}
          </datalist>
        </div>
        <div>
          <label htmlFor="yieldQuantity">This batch makes</label>
          <div>
            <input id="yieldQuantity" required type="number" min="0" step="any"
              value={yieldQuantity ?? ""} onChange={(e) => setYieldQuantity(e.target.value ? Number(e.target.value) : undefined)} />
            <select aria-label="Yield unit" value={yieldUnit} disabled={lockYieldUnit}
              onChange={(e) => setYieldUnit(e.target.value as "EACH" | "G" | "ML")}>
              {(Object.keys(YIELD_UNIT_LABELS) as ("EACH" | "G" | "ML")[]).map((u) => (
                <option key={u} value={u}>{YIELD_UNIT_LABELS[u]}</option>
              ))}
            </select>
          </div>
          {lockYieldUnit && <p>Unit is locked because dishes already use this batch.</p>}
        </div>
        <div>
          <label htmlFor="sellingPrice">
            Menu price per portion <span>(฿, optional)</span>
          </label>
          <input id="sellingPrice" type="number" min="0" step="any"
            value={sellingPrice ?? ""} onChange={(e) => setSellingPrice(e.target.value ? Number(e.target.value) : undefined)} />
          {sellingPrice && perPortion !== null && (
            <p>GP {(((sellingPrice - perPortion) / sellingPrice) * 100).toFixed(0)}% at this cost</p>
          )}
        </div>
        <div>
          <label htmlFor="portionSize">
            Portion size <span>(g or ml, optional)</span>
          </label>
          <input id="portionSize" type="number" min="0" step="any"
            value={portionSize ?? ""} onChange={(e) => setPortionSize(e.target.value ? Number(e.target.value) : undefined)} />
          {yieldUnit !== "EACH" && (
            <p>Lets us work out how many portions the batch makes.</p>
          )}
        </div>
      </section>

      <section>
        <h2>Ingredients in this batch</h2>
        <IngredientPicker suppliers={suppliers} categories={categories} onSelect={addIngredient} />
        {lines.length === 0 && <p>Pick ingredients above, then enter the quantity used for the whole batch.</p>}
        <div aria-live="polite">
          {notice && <p>{notice}</p>}
          {formError && (
            <p role="alert">
              {formError}
            </p>
          )}
        </div>
        <ul>
          {lines.map((line, index) => {
            const unitOptions = ALL_UNITS.filter((u) => unitFamily(u) === unitFamily(line.pricing.purchaseUnit));
            const estimateNote = estimateOverrides && line.ingredientId in estimateOverrides ? estimateOverrides[line.ingredientId] : line.estimateNote;
            return (
              <li
                key={`${line.ingredientId}-${index}`}
              >
                <span>
                  <Link
                    href={`/ingredients/${line.ingredientId}`}
                    target="_blank"
                    rel="noopener"
                    title="Edit this ingredient's supplier and price (opens in a new tab)"
                  >
                    {line.name}
                  </Link>
                  {estimateNote && (
                    <span>
                      {estimateNote}
                    </span>
                  )}
                </span>
                <input id={`bqty-${index}`} aria-label={`Quantity for ${line.name}`} type="number" min="0" step="any"
                  value={line.qtyText ?? (line.quantity || "")}
                  onChange={(e) => updateLine(index, { qtyText: e.target.value, quantity: Number(e.target.value) || 0 })} />
                <select aria-label={`Unit for ${line.name}`} value={line.unit}
                  onChange={(e) => updateLine(index, { unit: e.target.value as Unit })}>
                  {unitOptions.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
                <button type="button"
                  onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}>Remove</button>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        {costError ? (
          <p>A line uses a unit that doesn&apos;t match its ingredient. Fix its unit before saving.</p>
        ) : (
          <dl>
            <div>
              <dt>Batch cost</dt>
              <dd>{formatTHB(cost)}</dd>
            </div>
            <div>
              <dt>Cost {perUnitLabel}</dt>
              <dd>{perUnit !== null ? formatTHB(perUnit) : "Set the yield"}</dd>
            </div>
            {portions !== null && yieldUnit !== "EACH" && (
              <>
                <div>
                  <dt>Portions</dt>
                  <dd>{Math.floor(portions * 10) / 10}</dd>
                </div>
                <div>
                  <dt>Cost per portion</dt>
                  <dd>{perPortion !== null ? formatTHB(perPortion) : "n/a"}</dd>
                </div>
              </>
            )}
          </dl>
        )}
      </section>

      <section>
        <div>
          <label htmlFor="notes">Method / notes</label>
          <textarea id="notes" maxLength={LIMITS.notes} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div>
        </div>
      </section>

      <button type="submit" disabled={submitting || costError}>
        {submitting ? "Saving…" : "Save batch recipe"}
      </button>
    </form>
  );
}
